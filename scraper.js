const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function buscarTerrenos({ localizacao }) {
  let browser;
  try {
    console.log(`Iniciando busca por terrenos em: ${localizacao}`);

    browser = await puppeteer.launch({
      headless: false,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    // Configurar um user agent mais recente
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setDefaultNavigationTimeout(60000);

    console.log("Navegando para a página inicial do VivaReal...");
    await page.goto("https://www.vivareal.com.br/", {
      waitUntil: "networkidle2",
    });

    // Tirar screenshot da página inicial
    await page.screenshot({ path: path.join(__dirname, "vivareal-home.png") });
    console.log("Screenshot da página inicial salvo");

    // 2. Selecionar "Lote / Terreno"
    console.log("Tentando abrir o dropdown de tipo de imóvel");
    try {
      // Tentar diferentes seletores para o dropdown de tipo de imóvel
      const possiveisSeletoresDropdown = [
        "button#multiselect",
        'button[data-testid="property-type-dropdown"]',
        'button[aria-label="Tipo de imóvel"]',
        "button.js-select-property-type",
        'div[data-testid="property-type-field"] button',
      ];

      let dropdownClicado = false;
      for (const seletor of possiveisSeletoresDropdown) {
        if ((await page.$(seletor)) !== null) {
          console.log(`Dropdown encontrado com seletor: ${seletor}`);
          await page.click(seletor);
          dropdownClicado = true;
          break;
        }
      }

      if (!dropdownClicado) {
        throw new Error(
          "Não foi possível encontrar o dropdown de tipo de imóvel"
        );
      }

      // Tirar screenshot após abrir o dropdown
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await page.screenshot({
        path: path.join(__dirname, "dropdown-aberto.png"),
      });
      console.log("Screenshot do dropdown salvo");

      // Tentar encontrar a opção "Lote/Terreno" de várias maneiras
      console.log("Procurando opção Lote/Terreno...");

      // Método 1: Tentar o seletor original
      const opcaoLoteTerrenoSeletores = [
        "label[l-checkbox-150]",
        'label[data-testid="TERRAIN"]',
        'label[data-value="TERRAIN"]',
        'label:has-text("Lote/Terreno")',
        'div[role="option"]:has-text("Lote/Terreno")',
      ];

      let opcaoEncontrada = false;

      // Método 2: Se não encontrou pelos seletores, tentar buscar pelo texto
      if (!opcaoEncontrada) {
        console.log("Tentando encontrar opção pelo texto...");

        // Listar todas as opções disponíveis para debug
        const opcoesTexto = await page.evaluate(() => {
          const elementos = Array.from(
            document.querySelectorAll('label, div[role="option"]')
          );
          return elementos.map((el) => ({
            texto: el.textContent.trim(),
            id: el.id,
            classes: el.className,
            atributos: Object.fromEntries(
              Array.from(el.attributes).map((attr) => [attr.name, attr.value])
            ),
          }));
        });

        console.log(
          `Opções disponíveis: ${JSON.stringify(opcoesTexto, null, 2)}`
        );

        // Tentar clicar na opção que contém o texto "Lote" ou "Terreno"
        try {
          await page.evaluate(() => {
            const elementos = Array.from(
              document.querySelectorAll('label, div[role="option"], span, li')
            );
            const elemento = elementos.find(
              (el) =>
                el.textContent.toLowerCase().includes("lote") ||
                el.textContent.toLowerCase().includes("terreno")
            );

            if (elemento) {
              console.log(
                "Elemento encontrado pelo texto:",
                elemento.textContent
              );
              elemento.click();
              return true;
            }
            return false;
          });

          opcaoEncontrada = true;
          console.log("Opção Lote/Terreno clicada pelo texto");
        } catch (err) {
          console.error("Erro ao tentar clicar pelo texto:", err);
        }
      }

      if (!opcaoEncontrada) {
        throw new Error("Não foi possível encontrar a opção Lote/Terreno");
      }

      // Tirar screenshot após selecionar a opção
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await page.screenshot({
        path: path.join(__dirname, "opcao-selecionada.png"),
      });
      console.log("Screenshot da opção selecionada salvo");
    } catch (error) {
      console.error("Erro ao selecionar tipo de imóvel:", error.message);
      await page.screenshot({
        path: path.join(__dirname, "erro-tipo-imovel.png"),
      });
      throw new Error(`Falha ao selecionar tipo de imóvel: ${error.message}`);
    }

    // 1. Preencher a localização
    console.log(`Preenchendo localização: ${localizacao}`);
    try {
      const localizacaoInputSelector =
        'input[placeholder="Digite o nome da rua, bairro ou cidade"]';

      await page.waitForSelector(localizacaoInputSelector, { timeout: 10000 });

      // Clicar no input antes de digitar
      await page.click(localizacaoInputSelector);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Digitar a localização
      await page.type(localizacaoInputSelector, localizacao, { delay: 100 });
      console.log("Localização preenchida com sucesso");

      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error("Erro ao preencher localização:", error.message);
      await page.screenshot({
        path: path.join(__dirname, "erro-localizacao.png"),
      });
      throw new Error(`Falha ao preencher localização: ${error.message}`);
    }
    // 2. Esperar o dropdown aparecer e selecionar a sugestão correta
    try {
      const dropdownLabelSelector = ".l-dropdown__content label";

      await page.waitForSelector(dropdownLabelSelector, { timeout: 10000 });

      const cidadeSelecionada = localizacao;

      const labels = await page.$$(dropdownLabelSelector);
      let encontrou = false;

      for (const label of labels) {
        const span = await label.$("span");
        const textoSpan = await page.evaluate(
          (el) => el.textContent.trim(),
          span
        );

        if (textoSpan === cidadeSelecionada) {
          const input = await label.$("input.olx-core-checkbox-radio__input");
          if (input) {
            await input.click();
            encontrou = true;
            console.log(`Selecionado: ${textoSpan}`);
            await new Promise((resolve) => setTimeout(resolve, 3000));
            break;
          }
        }
      }

      if (!encontrou) {
        throw new Error(
          `Cidade "${cidadeSelecionada}" não encontrada no dropdown.`
        );
      }
    } catch (error) {
      console.error("Erro ao selecionar sugestão do dropdown:", error.message);
      await page.screenshot({
        path: path.join(__dirname, "erro-dropdown.png"),
      });
      throw new Error(`Falha ao selecionar sugestão: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // 3. Clicar no botão "Buscar"
    console.log("Clicando no botão Buscar");
    try {
      const possiveisBotoesBuscar = [".olx-core-loading-button"];

      let botaoClicado = false;
      for (const seletor of possiveisBotoesBuscar) {
        const botao = await page.$(seletor);
        if (botao) {
          console.log(`Botão Buscar encontrado com seletor: ${seletor}`);
          await botao.click();
          botaoClicado = true;
          break;
        }
      }

      console.log("Botão Buscar clicado, aguardando navegação...");
    } catch (error) {
      console.error("Erro ao clicar no botão Buscar:", error.message);
      await page.screenshot({
        path: path.join(__dirname, "erro-botao-buscar.png"),
      });
      throw new Error(`Falha ao clicar no botão Buscar: ${error.message}`);
    }

    // 4. Aguardar a página de resultados carregar
    try {
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      console.log(`Na página de resultados: ${page.url()}`);

      // Tirar screenshot da página de resultados
      await page.screenshot({ path: path.join(__dirname, "resultados.png") });
      console.log("Screenshot da página de resultados salvo");

      // Extrair informações básicas dos resultados
      const resultados = await page.evaluate(() => {
        // Tentar encontrar o contador de resultados
        let quantidade = 0;
        const contadorEl =
          document.querySelector('[data-testid="total-results"]') ||
          document.querySelector(".results-summary") ||
          document.querySelector(".js-total-records");

        if (contadorEl) {
          const textoContador = contadorEl.textContent;
          const match = textoContador.match(/\d+/);
          if (match) {
            quantidade = parseInt(match[0], 10);
          }
        }

        // Tentar extrair os primeiros 5 resultados
        const cards = Array.from(
          document.querySelectorAll(
            '.property-card, .js-property-card, [data-testid="property-card"]'
          )
        ).slice(0, 5);

        const lotes = cards.map((card) => {
          // Tentar extrair informações básicas
          const precoEl = card.querySelector(
            '.property-card__price, .js-property-card-prices, [data-testid="price"]'
          );
          const areaEl = card.querySelector(
            '.property-card__detail-area, .js-property-card-detail-area, [data-testid="property-card-detail-area"]'
          );
          const localEl = card.querySelector(
            '.property-card__address, .js-property-card-address, [data-testid="property-card-address"]'
          );

          return {
            tipo: "Lote/Terreno",
            preco: precoEl ? precoEl.textContent.trim() : "Preço não informado",
            area: areaEl ? areaEl.textContent.trim() : "Área não informada",
            localizacao: localEl
              ? localEl.textContent.trim()
              : "Localização não informada",
          };
        });

        return { quantidade, lotes };
      });

      console.log(`Encontrados ${resultados.quantidade} resultados`);

      if (browser) {
        await browser.close();
        console.log("Navegador fechado");
      }

      return {
        urlPaginaResultados: page.url(),
        quantidade_resultados: resultados.quantidade,
        lotes: resultados.lotes,
      };
    } catch (error) {
      console.error("Erro ao processar página de resultados:", error.message);
      await page.screenshot({
        path: path.join(__dirname, "erro-resultados.png"),
      });
      throw new Error(
        `Falha ao processar página de resultados: ${error.message}`
      );
    }
  } catch (error) {
    console.log(`Erro durante a busca pela home e scraping: ${error.message}`);
    if (browser) {
      await browser.close();
    }
    return { error: error.message };
  } finally {
    // Garantir que o browser seja fechado mesmo que haja um erro não capturado
    if (browser) {
      await browser.close();
      console.log("Navegador fechado");
    }
  }
}

module.exports = buscarTerrenos;
