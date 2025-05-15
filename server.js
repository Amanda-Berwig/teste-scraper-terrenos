const express = require("express");
const cors = require("cors");
const path = require("path");
const buscarTerrenos = require("./scraper");

const app = express();
const port = 3000;

// Configuração CORS simplificada
app.use(cors());

// Servir arquivos estáticos
app.use(express.static(__dirname));

// Rota para a página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "teste.html"));
});
app.use(express.json());

app.post("/buscar", async (req, res) => {
  const { localizacao } = req.body;
  console.log("🔍 Local recebido:", localizacao); // Verifique o que chega

  if (!localizacao) {
    return res.status(400).json({ erro: "Localização é obrigatória" });
  }

  try {
    const resultado = await buscarTerrenos({ localizacao });
    res.json({ localizacao, ...resultado });
  } catch (error) {
    console.error("❌ Erro no backend:", error.message);
    res
      .status(500)
      .json({ erro: "Erro ao buscar dados", detalhes: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
