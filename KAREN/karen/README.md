# KAREN

A Pen created on CodePen.

Original URL: [https://codepen.io/BARBOSA12/pen/pvNywoR](https://codepen.io/BARBOSA12/pen/pvNywoR).

## Banco escolar no Supabase

O banco escolar usa Supabase. No painel do projeto, abra o **SQL Editor**, cole o conteúdo de `supabase-schema.sql` e execute. Isso cria as tabelas `horarios` e `provas`.

Depois, cadastre os registros diretamente nas tabelas. Exemplo de horario:

```json
{
	"dia": "segunda-feira",
	"periodo": 1,
	"horario": "07:00",
	"sala": "101",
	"turma": "8A",
	"materia": "Matematica"
}
```

A tabela `horarios` pode receber os 9 periodos de cada uma das 12 salas. A Karen consulta o Supabase quando alguem perguntar por horario, sala, turma ou prova. Se nao encontrar um registro, ela informa que o cadastro precisa ser atualizado em vez de inventar uma resposta.

Copie `.env.example` para `.env` e preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. A chave `service_role` deve ficar somente no servidor e nunca no frontend. Depois instale as dependencias com `npm install` e inicie com `npm start`.

