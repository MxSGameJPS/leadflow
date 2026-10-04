# LeadFlow Intent Engine

O Intent Engine encontra sinais públicos de pessoas e empresas que já demonstram intenção de contratar desenvolvimento de site, sistema, aplicativo, e-commerce ou automação.

## Arquitetura

- LeadFlow continua local em Next.js + JavaScript + Prisma/SQLite.
- Agent-Reach roteia pesquisa Web/Exa e fontes sociais configuradas.
- Scrapling enriquece páginas cujo resultado inicial veio curto.
- OmniRoute classifica a intenção em lote.
- O LeadFlow calcula o score final de forma determinística e salva no mesmo `leadflow.db`.
- Nenhum Supabase, Redis ou fila em nuvem é necessário.

## Instalação segura no Windows

O setup padrão cria um ambiente Python isolado em `%USERPROFILE%\.leadflow-intent-venv` e instala Agent-Reach + Scrapling sem autorizar mudanças externas do Agent-Reach:

```powershell
npm run intent:setup
```

Para instalar/configurar também as dependências base do Agent-Reach, incluindo a pesquisa Web/Exa, execute explicitamente:

```powershell
npm run intent:setup:full
```

Diagnóstico:

```powershell
npm run intent:doctor
```

Fontes sociais como Reddit, X e Facebook podem exigir sessão/login controlados pelo próprio usuário. O LeadFlow não armazena senha nem copia cookies para o projeto; ele usa os backends que o `agent-reach doctor --json` reportar como disponíveis.

## Fluxo

1. Abra **Intenção** no menu do LeadFlow.
2. Selecione serviço, fontes e score mínimo.
3. Opcionalmente informe uma consulta própria.
4. Clique em **Buscar intenção**.
5. O sistema coleta, normaliza, deduplica, enriquece e classifica os sinais.
6. Oportunidades aprovadas entram na fila local.
7. **Enviar para CRM** cria/atualiza o lead usando `intent:<fingerprint>` como identificador externo, evitando duplicatas.

## Score

O score de 0 a 100 não é inventado pelo modelo. A classificação da IA fornece atributos e o LeadFlow aplica a fórmula:

- intenção explícita: até 30;
- estágio de compra: até 20;
- recência: até 20;
- compatibilidade com serviço: até 15;
- urgência: até 10;
- confiança da classificação: até 5.

Faixas: 85+ quente, 70–84 alta, 50–69 média, abaixo de 50 baixa.

## Scraping em escala

O MVP não faz crawling massivo em background. A prioridade é validar quais fontes trazem leads que realmente respondem e convertem. Scrapy/Obscura permanecem candidatos para uma fase posterior, se volume e bloqueios justificarem a complexidade.
