# Captação — inteligência comercial e acompanhamento

## Fluxo novo
- `/captacao` mostra candidatos classificados com motivos e alertas, uma fila de respostas prioritárias e resultados por segmento e abordagem.
- Resposta confirmada pelo OpenWA pode receber rascunho de resposta com IA, revisável e copiável manualmente; a IA não envia e não fecha reuniões.
- A reunião só é registrada pela ação humana a partir de uma resposta monitorada; o resultado fica no modelo `CommercialOutcome`.
- Acompanhamento avalia a conversa pelo OpenWA depois de cinco dias úteis do primeiro envio, identifica resposta, recusa, envio adicional ou histórico incompleto e não recomenda repetição quando existem dados insuficientes.
- Uma segunda tentativa pode ser escrita manualmente ou sugerida pela IA e exige aprovação individual explícita.
- O worker só envia o acompanhamento aprovado, revalidando o histórico. Aplica cota combinada de 10 envios/dia para primeiro contato + acompanhamento, descanso de 30 minutos, pausa no domingo e horário do Windows 08:00–18:00.
- O fluxo da Recuperação usa outra cota de 10/dia, mas ambos compartilham o descanso global. Envio incerto nunca é repetido automaticamente.

## Instalação no Windows
Faça backup do banco SQLite e atualize `main`.

```powershell
git switch main
git pull origin main
npx prisma migrate deploy
npx prisma generate
npm run test:capture
npm run clean:next
npm run dev
```

Reinicie também o worker. O novo modelo exige a migração `20261109234500_capture_followup`.

## Homologação necessária antes de ativar envios
1. Testar o build, a migração e a geração do Prisma no ambiente Windows.
2. Conferir resposta positiva, recusa, ausência de resposta e histórico truncado nas consultas ao OpenWA.
3. Aprovar acompanhamento com um número de teste e verificar se nunca existe uma terceira abordagem automática.
4. Confirmar cota combinada de 10, intervalo de 30 minutos, domingos e interrupção do expediente.
5. Comparar os indicadores com registros efetivos no CRM; a existência de uma sugestão não representa reunião ou contrato.
6. Confirmar que os contatos têm base adequada de comunicação e que recusas são respeitadas.

Este conjunto foi implementado no repositório sem disparar mensagens de teste. Não considerar em produção homologada sem validação no Windows e OpenWA.
