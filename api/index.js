const express = require('express');
const axios = require('axios');
const app = express();

// Suas credenciais e configuração (Use Environment Variables na Vercel!)
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || 'SEU_CLIENT_KEY_PADRAO';
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || 'SEU_CLIENT_SECRET_PADRAO';
// A URL DEVE ser a URL final do seu deploy na Vercel + /api/tiktok/callback
const YOUR_REDIRECT_URI = `https://apitest-omega-taupe.vercel.app/api/tiktok/callback`;
const TIKTOK_TOKEN_ENDPOINT = 'https://open.tiktokapis.com/v2/oauth/token/';

// Middleware para garantir que o redirect_uri esteja atualizado (específico da Vercel)
app.use((req, res, next) => {
  // Define o redirect_uri dinamicamente baseado na URL de deploy da Vercel, se disponível
  req.dynamicRedirectUri = `https://apitest-omega-taupe.vercel.app/api/tiktok/callback`;
  // Garante que YOUR_REDIRECT_URI também seja atualizado se necessário (para a troca do token)
  // if (YOUR_REDIRECT_URI !== req.dynamicRedirectUri) {
  //   // Atualiza a variável global se necessário (cuidado com concorrência se houvesse múltiplos usuários)
  //   // Para este caso de uso único, pode ser aceitável.
  //   console.log("Atualizando Redirect URI para:", req.dynamicRedirectUri);
  // }
  next();
});


// Rota raiz simples (opcional)
app.get('/api', (req, res) => {
  res.send(`Servidor de Callback TikTok rodando! sk: ${TIKTOK_CLIENT_KEY} - cs: ${TIKTOK_CLIENT_SECRET}`);
});

// Endpoint que recebe o callback do TikTok
// Note o caminho '/api/tiktok/callback' por causa da estrutura da Vercel
app.get('/api/tiktok/callback', async (req, res) => {
  const authorizationCode = req.query.code;
  const receivedState = req.query.state; // TODO: Validar o state!

  console.log('Callback recebido. Código:', authorizationCode);
  console.log('Usando Redirect URI para troca:', req.dynamicRedirectUri);


  if (!authorizationCode) {
    return res.status(400).send('Erro: Código de autorização não recebido.');
  }

  // --- Trocar o código pelo token ---
  try {
    const params = new URLSearchParams();
    params.append('client_key', TIKTOK_CLIENT_KEY);
    params.append('client_secret', TIKTOK_CLIENT_SECRET);
    params.append('code', authorizationCode);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', req.dynamicRedirectUri); // Usa a URI dinâmica

    const tokenResponse = await axios.post(TIKTOK_TOKEN_ENDPOINT, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token, expires_in, open_id, scope } = tokenResponse.data;

    console.log('Tokens recebidos do TikTok com sucesso.');
    // NUNCA faça log do refresh_token em produção! Log apenas para depuração.
    // console.log('Refresh Token:', refresh_token); 

    // --- Gerar HTML para exibir o Access Token ---
    // !!! ALERTA DE SEGURANÇA: NÃO FAÇA ISSO EM PRODUÇÃO !!!
    const htmlResponse = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Token TikTok Recebido</title>
          <style>
              body { font-family: sans-serif; padding: 20px; background-color: #f4f4f4; }
              .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
              h1 { color: #333; }
              p { color: #555; word-wrap: break-word; }
              strong { color: #000; }
              .warning { color: #d9534f; font-weight: bold; border: 1px solid #d9534f; padding: 10px; margin-top: 20px; border-radius: 4px; background-color: #f2dede;}
              .token { background-color: #eee; padding: 5px; border-radius: 4px; display: inline-block; max-width: 100%; overflow-wrap: break-word;}
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Autorização TikTok Concluída!</h1>
              <p>O código de autorização foi trocado pelos tokens abaixo.</p>
              <hr>
              <p><strong>Access Token:</strong> <span class="token">${access_token}</span></p>
              <p><strong>Expira em:</strong> ${expires_in} segundos</p>
              <p><strong>Open ID:</strong> ${open_id}</p>
              <p><strong>Escopos Autorizados:</strong> ${scope}</p>
              <p><strong>Refresh Token:</strong> (Recebido no servidor, não exibido aqui por segurança)</p>
              <hr>
              <p class="warning">
                  ATENÇÃO: Este Access Token é uma credencial sensível. Não o compartilhe! 
                  Esta página é apenas para fins de depuração e demonstração. 
                  Em uma aplicação real, nunca exiba tokens diretamente no HTML.
              </p>
               <p>Você pode fechar esta janela agora.</p>
          </div>
      </body>
      </html>
    `;

    res.status(200).send(htmlResponse);

  } catch (error) {
    console.error('Erro ao trocar código por token:', error.response?.data || error.message);
    const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    res.status(500).send(`
        <h1>Erro ao obter tokens do TikTok</h1>
        <p>Ocorreu um problema durante a troca do código de autorização.</p>
        <pre>${errorDetails}</pre>
    `);
  }
});

// Exporta o app para a Vercel usar
module.exports = app;

// O app.listen() não é necessário quando deployado na Vercel como serverless function,
// mas pode ser útil para testar localmente com `node api/index.js`.
// Se descomentar, use `if (process.env.NODE_ENV !== 'production') { ... }`
// const localPort = 3000;
// app.listen(localPort, () => {
//   console.log(`Servidor local rodando em http://localhost:${localPort}`);
// });