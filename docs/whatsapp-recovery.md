# LeadFlow — Recuperação de Leads (primeira etapa)

Esta entrega organiza a carteira existente. Não envia mensagens e não inicia prospecção automática.

## Abrir
- Menu **Recuperação**, rota `/recuperacao`.
- Exibe total de leads, segmentos da triagem e observações.
- Classifica pela etapa, campos existentes e recusas registradas no campo de observações.
- Não consulta nem importa automaticamente o histórico do WhatsApp: a lista de 199 conversas precisa ser integrada separadamente.

## OpenWA (opcional nesta etapa)
Instale e configure sua própria instância OpenWA em ambiente isolado. No `.env` do servidor LeadFlow:

```env
OPENWA_URL=https://seu-openwa.exemplo
OPENWA_API_KEY=chave_com_permissao_minima
OPENWA_SESSION_ID=id_da_sessao
```

O adaptador `src/services/whatsapp/openwaClient.js` apenas chama `GET /api/sessions/{id}` para consultar a conexão. Sem esses campos o painel permanece operacional e mostra "não configurado". Não instale o OpenWA dentro do processo Next.js nem publique a API key no navegador.

## Conformidade e próxima etapa
- Não interpretar silêncio como consentimento.
- Bloquear contatos com recusa, opt-out ou encerramento.
- Exigir verificação de elegibilidade para qualquer envio posterior.
- Persistir conversas e consentimentos em repositório local coerente com o armazenamento atual; não acoplar a novos serviços externos.
- Implementar importação de históricos com revisão humana, webhooks com autenticação/verificação, deduplicação e idempotência.
- Máquina de estados inspirada no Harvey: triagem -> abordagem revisada -> resposta -> qualificação -> reunião -> encerramento.
- IA posterior deve ser opcional, auditável e ter tomada de controle humano.
- Não ativar execução periódica até existirem autorização explícita, limites e desligamento imediato.

## Testes
```bash
node --test tests/whatsapp-recovery.test.mjs
npm run build
```

A implementação foi registrada em branch de desenvolvimento e requer verificação local antes de merge para `main`.
