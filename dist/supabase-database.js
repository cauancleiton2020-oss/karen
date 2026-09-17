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

export async function buscarDadosEscola(mensagem) {
    const pergunta = normalizarTexto(mensagem);
    const querHorario = /horario|aula|sala|turma/.test(pergunta);
    const querProva = /prova|avaliacao|teste|exame/.test(pergunta);

    if (!querHorario && !querProva) {
        return "Nenhuma consulta de horario ou prova foi identificada.";
    }

    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseKey) {
        return "O Supabase ainda nao foi configurado. Cadastre SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env.";
    }

    const consultarTabela = async (tabela, campos, ordenacao) => {
        const url = new URL(`${supabaseUrl}/rest/v1/${tabela}`);
        url.searchParams.set("select", campos);
        url.searchParams.set("order", ordenacao);

        const resposta = await fetch(url, {
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`
            }
        });

        if (!resposta.ok) {
            throw new Error(`${tabela}: ${resposta.status} ${await resposta.text()}`);
        }

        return { data: await resposta.json(), error: null };
    };

    let horariosResult = { data: [], error: null };
    let provasResult = { data: [], error: null };

    try {
        if (querHorario) {
            horariosResult = await consultarTabela(
                "horarios",
                "dia,periodo,horario,sala,turma,materia",
                "dia,periodo"
            );
        }

        if (querProva) {
            provasResult = await consultarTabela(
                "provas",
                "data,horario,sala,turma,materia",
                "data,horario"
            );
        }
    } catch (erro) {
        console.error("Erro ao consultar Supabase:", erro);
        return "Nao consegui consultar o banco escolar agora. Verifique as tabelas do Supabase.";
    }

    if (horariosResult.error || provasResult.error) {
        console.error("Erro ao consultar Supabase:", horariosResult.error || provasResult.error);
        return "Nao consegui consultar o banco escolar agora. Verifique as tabelas do Supabase.";
    }

    const horarios = filtrarRegistros(horariosResult.data || [], mensagem);
    const provas = filtrarRegistros(provasResult.data || [], mensagem);

    if (!horarios.length && !provas.length) {
        return "Nao ha horario ou prova cadastrado para essa pergunta. Nao invente uma resposta e diga que o cadastro precisa ser atualizado no Supabase.";
    }

    return JSON.stringify({ horarios, provas });
}
