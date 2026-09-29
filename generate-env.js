// Script executado pelo Netlify antes do deploy
// Gera o arquivo js/env.js a partir das variáveis de ambiente do Netlify
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERRO: Variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY não encontradas!');
  console.error('Configure-as no painel do Netlify em: Site configuration > Environment variables');
  process.exit(1);
}

const content = `// ========================================================
// BOYDEGUSTA - VARIÁVEIS DE AMBIENTE
// Gerado automaticamente pelo build do Netlify. NÃO editar manualmente.
// ========================================================

window.ENV = {
  SUPABASE_URL: '${supabaseUrl}',
  SUPABASE_ANON_KEY: '${supabaseAnonKey}'
};
`;

fs.writeFileSync('./js/env.js', content);
console.log('✅ js/env.js gerado com sucesso!');
