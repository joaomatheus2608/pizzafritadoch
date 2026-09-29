// Script executado pelo Netlify antes do deploy
// Gera o arquivo js/env.js a partir das variáveis de ambiente do Netlify
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ AVISO: SUPABASE_URL ou SUPABASE_ANON_KEY não encontradas no ambiente.');
  console.warn('Configure-as no painel do Netlify em: Site configuration > Environment variables');
}

const content = `// ========================================================
// PIZZA FRITA DO CH - VARIÁVEIS DE AMBIENTE
// Gerado automaticamente pelo build do Netlify. NÃO editar manualmente.
// ========================================================

window.ENV = {
  SUPABASE_URL: '${supabaseUrl}',
  SUPABASE_ANON_KEY: '${supabaseAnonKey}'
};
`;

fs.writeFileSync('./js/env.js', content);
console.log('✅ js/env.js gerado com sucesso a partir das variáveis do Netlify!');
