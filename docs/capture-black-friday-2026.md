# LeadFlow — Operação Black Friday 2026

## Oferta
Página profissional por **R$ 500**, SEO avançado, configuração/atualização elegível no Google, inclusão elegível no Waze, hospedagem gratuita e 30 dias de suporte. Prévia personalizada gratuita é **proposta futura**, nunca afirmar que já está pronta.

## Operação local
1. Na Central `/captacao`, clique **Ativar Black Friday**, confirme `ATIVAR BLACK FRIDAY`. Isso **não inicia o envio**.
2. No CRM `/crm`, filtre contatos novos e apropriados. Use **Aprovar N para Captação** para autorizar os contatos individualmente pelo lote. Novas aprovações usam mensagem Black Friday com variação por lead.
3. Para ficha individual: **Agente de Captação → Consultar situação → revisar mensagem/telefone → Aprovar primeiro contato**.
4. Ative separadamente o botão **Iniciar Captação** e mantenha o worker local em execução.
5. Na Central, acompanhe aprovados/enviados e priorize respostas positivas para contato humano. A IA apenas sugere respostas.

## Proteções mantidas
- 10 mensagens por dia na Captação, 08h–18h no relógio Windows, sem domingo, intervalo mínimo de 30 minutos. A Recuperação continua independente.
- Campanha desligada por padrão e ativa somente em novembro de 2026.
- Mensagens já aprovadas não são reescritas; a promoção só prioriza aprovações identificadas como Black Friday.
- Mensagens promocionais não são reescritas pela IA depois da aprovação.
- Desativar a campanha retém mensagens promocionais ainda pendentes; para parar todos os envios, também pause a Captação.
- Não reenviar resultados incertos nem desrespeitar recusas. Não prometer ranking, prazo de entrega ou prévia já pronta.
- Envio de áudio não implementado: depende de verificação da API de mídia do OpenWA.

## Validação
```powershell
npm run test:capture
npm run build
```
