import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.join(__dirname, "..", "data");
const databasePath = path.join(dataDirectory, "karen.db");
const legacyDataPath = path.join(__dirname, "dados-escola.json");

fs.mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(databasePath);

database.exec(`
    CREATE TABLE IF NOT EXISTS horarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dia TEXT NOT NULL,
        periodo INTEGER NOT NULL CHECK (periodo BETWEEN 1 AND 9),
        horario TEXT NOT NULL,
        sala TEXT NOT NULL,
        turma TEXT NOT NULL,
        materia TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        horario TEXT NOT NULL,
        sala TEXT NOT NULL,
        turma TEXT NOT NULL,
        materia TEXT NOT NULL
    );
`);

function importarDadosLegados() {
    const total = database.prepare("SELECT COUNT(*) AS total FROM horarios").get().total;

    if (total > 0 || !fs.existsSync(legacyDataPath)) {
        return;
    }

    const dados = JSON.parse(fs.readFileSync(legacyDataPath, "utf8"));
    const inserirHorario = database.prepare(`
        INSERT INTO horarios (dia, periodo, horario, sala, turma, materia)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const inserirProva = database.prepare(`
        INSERT INTO provas (data, horario, sala, turma, materia)
        VALUES (?, ?, ?, ?, ?)
    `);

    database.exec("BEGIN");
    try {
        for (const horario of dados.horarios || []) {
            inserirHorario.run(
                horario.dia || "",
                Number(horario.periodo) || 0,
                horario.horario || "",
                horario.sala || "",
                horario.turma || "",
                horario.materia || ""
            );
        }

        for (const prova of dados.provas || []) {
            inserirProva.run(
                prova.data || "",
                prova.horario || "",
                prova.sala || "",
                prova.turma || "",
                prova.materia || ""
            );
        }

        database.exec("COMMIT");
    } catch (erro) {
        database.exec("ROLLBACK");
        throw erro;
    }
}

importarDadosLegados();

function normalizarTexto(texto) {
    return String(texto)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

const palavrasIgnoradas = new Set([
    "qual", "quais", "quando", "onde", "tem", "sobre", "para", "das", "dos",
    "sao", "essa", "esse", "uma", "com", "por", "me", "diga", "mostrar",
    "hoje", "dia", "dias"
]);

const palavrasDeIntent = new Set([
    "horario", "aula", "sala", "turma", "prova", "avaliacao", "teste", "exame"
]);

function filtrarRegistros(registros, mensagem) {
    const termos = normalizarTexto(mensagem)
        .split(/[^a-z0-9]+/)
        .filter((termo) => termo.length > 2 && !palavrasIgnoradas.has(termo));
    const termosDeBusca = termos.filter((termo) => !palavrasDeIntent.has(termo));

    if (!termosDeBusca.length) {
        return registros;
    }

    return registros.filter((registro) => {
        const texto = normalizarTexto(Object.values(registro).join(" "));
        return termosDeBusca.some((termo) => texto.includes(termo));
    });
}

export function buscarDadosEscola(mensagem) {
    const pergunta = normalizarTexto(mensagem);
    const querHorario = /horario|aula|sala|turma/.test(pergunta);
    const querProva = /prova|avaliacao|teste|exame/.test(pergunta);

    if (!querHorario && !querProva) {
        return "Nenhuma consulta de horario ou prova foi identificada.";
    }

    const horarios = querHorario
        ? filtrarRegistros(database.prepare(`
            SELECT dia, periodo, horario, sala, turma, materia
            FROM horarios
            ORDER BY dia, periodo, sala
        `).all(), mensagem)
        : [];
    const provas = querProva
        ? filtrarRegistros(database.prepare(`
            SELECT data, horario, sala, turma, materia
            FROM provas
            ORDER BY data, horario
        `).all(), mensagem)
        : [];

    if (!horarios.length && !provas.length) {
        return "Nao ha horario ou prova cadastrado para essa pergunta. Nao invente uma resposta e diga que o cadastro precisa ser atualizado no banco de dados.";
    }

    return JSON.stringify({ horarios, provas });
}
