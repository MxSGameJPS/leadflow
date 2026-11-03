# Segunda tentativa de Recuperação

## Fluxo operacional
1. O worker consulta periodicamente até quatro conversas de recuperação com primeiro envio confirmado e já vencido o prazo de cinco dias úteis. A verificação utiliza o histórico ao vivo do OpenWA (últimas 100 mensagens).
2. Só há sugestão quando a primeira mensagem foi encontrada, não existe resposta posterior e não houve outro envio manual após o primeiro. Históricos truncados, recusas e resultados incertos não autorizam contato.
3. Em `/recuperacao/segunda-tentativa`, revise a data e a recomendação; gere um rascunho com OmniRoute ou escreva outro texto, e aprove explicitamente.
4. O worker reconsulta o histórico antes de enviar. Uma segunda tentativa não pode ser armada novamente após ter sido enviada. O intervalo inicial é de cinco dias úteis e o limite total é de duas tentativas nesta rotina.
5. Os envios usam o mesmo limite diário de 10 da Recuperação, o expediente do Windows (08:00–18:00, domingo bloqueado), intervalo de descanso de 30 minutos e a chave geral de ativação. A Captação permanece com seus 10 envios próprios.
6. Envio com confirmação incerta não é repetido automaticamente. Consulte manualmente o WhatsApp e revise o registro antes de qualquer nova ação.

## Atualização local
```powershell
git pull origin feat/recovery-second-attempt-20261103
npx prisma migrate deploy
npx prisma generate
npm run clean:next
npm run dev
```
Reinicie o worker após gerar o cliente Prisma. Faça backup do SQLite antes de aplicar a migração.

## Limites desta versão
- Somente conversas cujo primeiro envio foi confirmado pelo mecanismo de Recuperação aparecem automaticamente como candidatas. Mensagens antigas enviadas apenas manualmente, sem registro de despacho, exigirão uma etapa de importação auditada.
- A sugestão de IA é um rascunho, não uma autorização para envio.
- Análise automática depende do worker e do OpenWA operacionais.
- A API de histórico devolve até 100 mensagens; históricos incompletos devem ser revisados sem envio.
- É necessário homologar a migração, os cálculos de prazo, o fluxo de aprovação e o envio com um número de teste antes de mesclar à main.
