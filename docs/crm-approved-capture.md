# CRM — Aprovados para Captação

## Uso
1. Abra `/crm` na instalação local do LeadFlow.
2. Na aba **Leads**, selecione os contatos pelos checkboxes, ou use **Selecionar exibidos** depois de filtrar por cidade e nicho.
3. Clique em **Aprovar N para Captação** e confirme a autorização de primeiro contato. O limite por operação é de 50 leads.
4. A nova aba **Aprovados** exibe a fila, os contatos enviados, resultados incertos e casos de número pendente.
5. O agente usa o WhatsApp cadastrado (ou o telefone alternativo válido) sem exigir uma confirmação manual prévia de existência no WhatsApp. Ele prepara uma abordagem contextual por segmento; para aprovações do lote, o worker tenta enriquecer a mensagem usando IA, mantendo um modelo local como fallback.
6. Somente contatos com autorização explícita, status aprovado e destino normalizado entram no fluxo existente de envio do worker, sujeito ao controle de ligar/desligar Captação, horário das 08h às 18h, bloqueio dominical, intervalo de 30 minutos e limite diário de 10 envios.
7. Use **Pausar novas aprovações** para interromper novos lotes; aprovações antigas na fila permanecem intactas.

## Correções e revisões
- **Número pendente**: nenhum número utilizável na ficha. Corrija o cadastro e clique em **Reenfileirar após corrigir número**.
- **Corrigir número**: o OpenWA retornou erro explícito identificando destino inválido. Corrija o telefone e reenfileire; o número anterior não é repetido.
- **Envio incerto**: timeout, falha de rede ou erro que não prova que a mensagem deixou de ser entregue. Não repita sem conferir o WhatsApp.
- **Revisar mensagem**: falha antes do envio ou contato manual mais recente que a aprovação. Revise o caso.
- Leads já contatados no CRM, com registro de Captação, recuperados ou em negociação/encerrados não devem ser classificados automaticamente como primeiro contato.

## Homologação
```powershell
git switch main
git pull origin main
npm run test:capture
npm run clean:next
npm run dev
```
Nenhuma nova migração Prisma foi criada nesta funcionalidade (o projeto ainda depende das migrações de etapas anteriores já presentes na `main`). Para instalações desatualizadas, faça backup do SQLite e execute `npx prisma migrate deploy` e `npx prisma generate` antes do teste.

Teste com um contato próprio primeiro e verifique a fila, o envio único, os limites e as mensagens. Não houve homologação real de envio OpenWA nesta implementação.
