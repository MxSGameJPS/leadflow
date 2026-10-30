# Agente Social Media — LeadFlow local

## O que funciona
- Estúdio em `/social-media`: upload local de imagens/vídeos, carrossel ordenado, legenda editável e geração opcional pelo OmniRoute.
- Calendário com rascunhos, aprovação manual e agendamento para Facebook e Instagram.
- O worker de desenvolvimento existente verifica o calendário a cada ciclo (~60s) mesmo fora das 08h–18h. Posts agendados são independentes do expediente dos agentes WhatsApp.
- Registro separado do resultado da publicação por rede. Um resultado incerto **não é reenviado automaticamente**.

## Configuração local (.env)
```env
META_APP_ID=3133033087028140
META_APP_SECRET=
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=
META_IG_USER_ID=
META_GRAPH_VERSION=v25.0
# Opcional: upload público das mídias via Supabase Storage
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
META_SOCIAL_MEDIA_BUCKET=social-media
```

**Nunca** versionar tokens, segredo do app ou a chave service-role. O arquivo de contexto Meta fornecido é apenas referência de configuração, não é necessário importá-lo para o código. Confirme a versão da Graph API suportada pelo aplicativo.

## Hospedagem de mídias
Arquivos enviados ficam em `data/social-media/`, ignorados pelo Git. Se a integração com o Supabase Storage estiver configurada, também são enviados ao bucket **público** `social-media` e as URLs HTTPS são anexadas ao rascunho automaticamente. Configure permissões do bucket e verifique se as URLs podem ser acessadas externamente sem autenticação. Caso o bucket não esteja configurado, o upload continua local como **rascunho**, sem possibilidade de agendamento até que as URLs sejam públicas. URLs HTTPS externas também podem ser informadas manualmente.

O Instagram aceita imagens JPEG (e vídeos compatíveis); para imagens PNG converta para JPEG antes do agendamento. Carrosséis de 2–10 itens. Vídeos de processamento longo podem precisar de revisão manual.

## Segurança operacional
- Somente posts aprovados explicitamente na interface com data/hora futura são publicados automaticamente.
- O arquivo de mídia e a legenda são dados editoriais; o OmniRoute gera sugestões de legenda **sob demanda** e não cria agendas ou publica por conta própria.
- Estados de publicação: `draft`, `scheduled`, `publishing`, `published`, `needs_review`, `cancelled`. Em falhas de conexão com a Meta, o status da plataforma fica `uncertain` e não há retry automático; verifique diretamente na rede.
- Para uso somente local no ambiente atual (rotas administrativas bloqueadas em `NODE_ENV=production` sem autenticação implementada).
- Para publicação Instagram é necessário conta profissional e as permissões aprovadas para as contas Meta envolvidas.

## Instalação
```powershell
git pull origin main
npx prisma migrate deploy
npx prisma generate
npm run clean:next
npm run dev
```

## Limitações desta versão
- Ainda não traz métricas/insights de alcance e engajamento, replies de comentários/DMs, calendário sugerido automaticamente com cadência semanal, nem integração de desempenho com o CRM.
- Reagendamento cancela/substitui apenas posts ainda não iniciados. Publicações com resultado incerto exigem conferência manual; não existe botão para reenviar.
- O worker precisa estar executando na hora agendada; se o PC estiver desligado, o post é publicado no próximo ciclo após religar. Não existe agendamento hospedado na Meta para a versão Instagram.

## Cloudflare R2 (fluxo atual)
Configure no `.env`, somente no computador:
```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=leadflow-social-media
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
```
- No R2, use token S3 de Object Read & Write restrito ao bucket. Não cole credenciais no chat.
- O upload inicial fica apenas em `data/social-media/`. Na aprovação do agendamento, a API envia as mídias do rascunho para o R2 e substitui as URLs locais pelas públicas. Rascunhos antigos são preparados automaticamente: não é necessário reenviar as imagens.
- Carrosséis para Instagram com PNG são convertidos para JPEG com `sharp`, preservando cópias locais originais. Se o pacote não estiver instalado e a conversão falhar, execute `npm install sharp` e reinicie a aplicação.
- Somente postagens com status **published** e com todos os canais confirmados são candidatas à exclusão; a limpeza só começa 24 horas depois da confirmação, e evita apagar arquivos usados em outras publicações pendentes ou recentes.
- Status `needs_review`, `publishing`, `uncertain` e agendamentos pendentes **nunca autorizam a limpeza**. Sem retorno de sucesso da Meta o arquivo permanece no bucket.
- O worker faz a limpeza de forma periódica enquanto o LeadFlow estiver ligado. Os originais locais permanecem preservados; a API de status `/api/social/storage` informa configuração e contadores, sem expor chaves.
- Use `.r2.dev` para testes; URLs de desenvolvimento têm limites e podem não atender produção de alto tráfego. Para uso regular prefira um domínio personalizado.
