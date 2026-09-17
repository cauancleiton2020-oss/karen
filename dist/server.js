import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Groq } from "groq-sdk";
import { buscarDadosEscola } from "./supabase-database.js";

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.GROQ_API_KEY && !process.env.GROK_API_KEY) {
    dotenv.config({ path: path.join(__dirname, ".env") });
}

const app = express();

const apiKey = process.env.GROQ_API_KEY?.trim() || process.env.GROK_API_KEY?.trim();
const groqModel = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
const groq = new Groq({ apiKey });
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY?.trim();
const elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL";

function getGrokErrorMessage(erro) {
    const message = erro?.error?.message || erro?.message || "";

    if (erro?.status === 429 || message.includes("credits") || message.includes("quota") || message.includes("rate limit")) {
        return "A Groq está sem créditos disponíveis ou excedeu o limite de requisições.";
    }

    if (erro?.status === 401 || message.includes("API key") || message.includes("Unauthorized")) {
        return "A chave da Groq está inválida ou expirada.";
    }

    if (!apiKey) {
        return "A variável GROQ_API_KEY não foi encontrada no arquivo .env.";
    }

    return "Erro ao conversar com a Groq.";
}

async function enviarParaGrok(mensagem) {
    const resposta = await groq.chat.completions.create({
        model: groqModel,
        messages: [
            {
                role: "user",
                content: mensagem
            }
        ],
        temperature: 0.7,
        max_completion_tokens: 2048,
        top_p: 1
    });

    const conteudo = resposta?.choices?.[0]?.message?.content;

    if (typeof conteudo === "string") {
        return conteudo;
    }

    if (Array.isArray(conteudo)) {
        return conteudo.map((item) => item?.text || "").join(" ").trim();
    }

    return "Não consegui responder no momento.";
}


// ===============================
// CONFIGURAÇÕES
// ===============================

app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
    const caminhoSolicitado = req.path.toLowerCase();

    if (caminhoSolicitado === "/.env" || caminhoSolicitado.endsWith("/.env")) {
        return res.status(404).send("Not found");
    }

    next();
});

app.use(express.static(__dirname, { dotfiles: "deny" }));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ===============================
// KAREN
// ===============================

app.post("/api/karen", async (req, res) => {

    try {

        const mensagem =
            req.body.mensagem;


        if (!mensagem) {

            return res.status(400).json({
                erro: "Mensagem vazia."
            });

        }


        const resposta = await enviarParaGrok(`
Você é Karen, a inteligência artificial do Plankton em Bob Esponja.

Você é extremamente inteligente, sarcástica, robótica e confiante.
Seu humor é seco e irônico, mas engraçado.
Responda sempre em português do Brasil.
Responda de forma curta e natural.
Não escreva textos enormes.

Você foi recriada pelos alunos:
Cauan Albert, Miguel, Júlia, Benjamim e Arthur.

O projeto foi desenvolvido para uma apresentação escolar.
Se perguntarem sobre o desenvolvimento, explique que o grupo enfrentou dificuldades com:
- programação;
- reconhecimento de voz;
- criação do corpo físico;
- integração da IA;
- medo de o projeto não funcionar.

Mesmo assim, o grupo conseguiu concluir o projeto trabalhando junto.
Você pode provocar os humanos de maneira leve e divertida.
Mantenha a personalidade da Karen durante toda a conversa.

Quando a pergunta envolver horarios, salas, aulas, turmas ou provas, use exclusivamente os dados abaixo.
Nao invente datas, horarios, salas ou materias. Se os dados nao responderem a pergunta, informe que nao ha cadastro e oriente a consultar a secretaria.

Dados escolares encontrados:
${await buscarDadosEscola(mensagem)}

Mensagem do usuário: ${mensagem}
`);

        res.json({
            resposta
        });

    }


    catch (erro) {

        console.error(
            "Erro Grok:",
            erro
        );

        const statusCode =
            erro?.status === 401 || erro?.status === 429
                ? erro.status
                : 500;

        res.status(statusCode).json({
            erro: getGrokErrorMessage(erro)
        });

    }

});

app.post("/api/voice", async (req, res) => {
    try {
        const texto = req.body.texto || req.body.text || "";

        if (!texto || !texto.trim()) {
            return res.status(400).json({ erro: "Texto da fala vazio." });
        }

        if (!elevenLabsApiKey) {
            return res.status(400).json({
                erro: "ELEVENLABS_API_KEY não configurada. O navegador vai usar a voz nativa como fallback."
            });
        }

        const resposta = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "xi-api-key": elevenLabsApiKey
            },
            body: JSON.stringify({
                text: texto,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    style: 0.2,
                    use_speaker_boost: true
                }
            })
        });

        if (!resposta.ok) {
            const erroDetalhe = await resposta.text();
            console.error("Erro ElevenLabs:", erroDetalhe);
            return res.status(500).json({
                erro: "Falha ao gerar áudio com o ElevenLabs."
            });
        }

        const buffer = Buffer.from(await resposta.arrayBuffer());
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.send(buffer);
    } catch (erro) {
        console.error("Erro ao gerar voz:", erro);
        res.status(500).json({
            erro: "Erro ao gerar voz da Karen."
        });
    }
});


// ===============================
// SERVIDOR
// ===============================

const PORT =
    process.env.PORT || 3000;

if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log(
            `Karen rodando em http://localhost:${PORT}`
        );
    });
}

export default app;