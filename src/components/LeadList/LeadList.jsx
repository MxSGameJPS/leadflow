"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { decodeSmart } from "../../services/imports/parseLeads.js";
import { buildPlacesCsv, placesCsvFilename } from "../../services/exports/placeResultsCsv.js";
import { buildLeadsJson, buildLeadsVCard, leadExportFilename } from "../../services/exports/leadExports.js";
import { importTextAction } from "../../app/actions/leads.js";
import { addPlacesToCrmAction, listCitiesAction, searchPlacesAction } from "../../app/actions/places.js";
import s from "./LeadList.module.css";
import {uniquePlaces,filterPlaceResults,searchKey} from "../../services/places/searchResults.js";

const STAGE_LABEL = {
  novo: "Base",
  contatado: "Contatado",
  sem_resposta: "Sem resposta",
  com_resposta: "Com resposta",
  proposta: "Proposta",
  proposta_rejeitada: "Proposta rejeitada",
  negociacao: "Negociação",
  ganho: "Convertido",
  perdido: "Perdido",
};

const STATES = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
];

const CATEGORIES = [
  "Academia", "Advocacia", "Agência de Viagens", "Auto Elétrica", "Auto Peças", "Bar / Botequim",
  "Barbearia", "Borracharia", "Cafeteria", "Chaveiro", "Clínica Estética", "Clínica Médica",
  "Contabilidade", "Creche / Escola Infantil", "Cursos / Treinamentos", "Eletricista", "Encanador",
  "Escola de Idiomas", "Escola Particular", "Farmácia", "Fisioterapia", "Floricultura",
  "Funilaria e Pintura", "Hamburgueria", "Imobiliária", "Joalheria", "Laboratório de Exames",
  "Lanchonete", "Lavanderia", "Lava-Rápido", "Loja de Calçados", "Loja de Roupas",
  "Manicure / Nail Art", "Marcenaria / Móveis", "Marmitaria", "Material de Construção", "Mecânica",
  "Nutrição", "Odontologia", "Óptica", "Padaria", "Papelaria / Livraria", "Pet Shop",
  "Pilates / Yoga", "Pintor", "Pizzaria", "Psicologia", "Pousada / Hotel", "Restaurante",
  "Salão de Beleza", "Seguradora", "Sorveteria", "Supermercado", "Veterinária",
];

function whatsappLink(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  else if ((digits.length !== 12 && digits.length !== 13) || !digits.startsWith("55")) return null;
  return `https://wa.me/${digits}`;
}

function ResultCard({ item, checked, onToggle, onAdd, busy, saved }) {
  const wa = item.possibleWhatsApp ? whatsappLink(item.phone) : null;

  return <article className={`${s.resultCard} ${checked ? s.resultSelected : ""}`}>
    <div className={s.resultTop}>
      <button type="button" className={s.check} aria-label={`Selecionar ${item.name}`} aria-pressed={checked} onClick={onToggle}>{checked ? "✓" : ""}</button>
      <div className={s.resultIdentity}>
        <strong title={item.name}>{item.name}</strong>
        <div className={s.badges}><span>{item.segment}</span>{saved&&<span>Já está na base</span>}<b className={item.grade === "A" ? s.hot : s.warm}>{item.grade === "A" ? "Quente" : "Oportunidade"}</b></div>
      </div>
      <div className={s.resultScore}><strong>{item.score}</strong><small>nota {item.grade}</small></div>
    </div>

    <div className={s.resultDetails}>
      <p><b>Telefone</b><span>{item.phone || "Não encontrado"}</span>{item.possibleWhatsApp && <em>Possível WhatsApp</em>}</p>
      <p><b>E-mail</b><span>{item.email || "Não encontrado"}</span></p>
      <p><b>Local</b><span>{[item.city, item.location].filter(Boolean).join(" / ")}</span></p>
      <p><b>Endereço</b><span>{item.address || "Não informado"}</span></p>
      <p><b>Google</b><span>{item.googleRating ? `${item.googleRating} ★ · ${item.googleReviews || 0} avaliações` : "Sem avaliação"}</span></p>
      <p><b>Presença</b><span className={item.hasOwnSite ? s.ownSite : s.opportunity}>{item.presenceType}</span></p>
    </div>

    <div className={s.resultHint}>{item.problem}</div>
    <div className={s.resultActions}>
      <button type="button" onClick={onAdd} disabled={busy}>{busy ? "Enviando…" : saved ? "Atualizar no CRM" : "Enviar para CRM"}</button>
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer">Abrir possível WhatsApp</a>}
      {item.email && <a href={"mailto:" + item.email}>E-mail</a>}
      {item.site && <a href={item.site} target="_blank" rel="noopener noreferrer">Abrir presença</a>}
      {item.mapsLink && <a href={item.mapsLink} target="_blank" rel="noopener noreferrer">Maps</a>}
    </div>
  </article>;
}

export default function LeadList({ initialLeads = [] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [contact, setContact] = useState("all");
  const [grade, setGrade] = useState("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [filters, setFilters] = useState({ country: "BR", state: "RS", city: "", neighborhood: "", category: "Restaurante", count: 20 });
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [citiesError, setCitiesError] = useState("");
  const [places, setPlaces] = useState([]);
  const [resultFilters,setResultFilters]=useState(null);
  const [hasSearched,setHasSearched]=useState(false);
  const [resultQuery,setResultQuery]=useState("");
  const [resultPresence,setResultPresence]=useState("all");
  const [resultSort,setResultSort]=useState("score");
  const [citiesRetry,setCitiesRetry]=useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [searching, setSearching] = useState(false);
  const [addingIds, setAddingIds] = useState(() => new Set());
  const [placesNotice, setPlacesNotice] = useState("");

  useEffect(() => setLeads(initialLeads), [initialLeads]);

  useEffect(() => {
    if (filters.country !== "BR") {
      setCities([]);
      setLoadingCities(false);
      setCitiesError("");
      return undefined;
    }

    let active = true;
    setLoadingCities(true);
    setCitiesError("");

    listCitiesAction(filters.state)
      .then(items => {
        if (!active) return;
        setCities(items);
        setFilters(current => {
          if (current.country !== "BR" || current.state !== filters.state) return current;
          return items.includes(current.city) ? current : { ...current, city: "" };
        });
      })
      .catch(error => {
        if (!active) return;
        setCities([]);
        setCitiesError(error.message || "Não foi possível carregar as cidades.");
      })
      .finally(() => {
        if (active) setLoadingCities(false);
      });

    return () => { active = false; };
  }, [filters.country, filters.state,citiesRetry]);

  const counts = useMemo(() => ({
    total: leads.length,
    whatsapp: leads.filter(item => item.whatsapp).length,
    phone: leads.filter(item => item.phone).length,
    noContact: leads.filter(item => !item.whatsapp && !item.phone && !item.email && !item.instagram).length,
    noSite: leads.filter(item => !item.site || item.weakSite).length,
  }), [leads]);

  const visible = useMemo(() => leads.filter(item => {
    if (grade !== "all" && item.grade !== grade) return false;
    if (contact === "whatsapp" && !item.whatsapp) return false;
    if (contact === "no-contact" && (item.whatsapp || item.phone || item.email || item.instagram)) return false;
    if (contact === "no-site" && item.site && !item.weakSite) return false;
    if (search) {
      const q = searchKey(search);
      const text = [item.name, item.segment, item.city, item.location, item.phone, item.whatsapp, item.email, item.site].filter(Boolean).join(" ");
      if (!searchKey(text).includes(q)) return false;
    }
    return true;
  }), [leads, search, contact, grade]);

  const resultVisible=useMemo(()=>filterPlaceResults(places,{query:resultQuery,presence:resultPresence,sort:resultSort}),[places,resultQuery,resultPresence,resultSort]);
  const knownIds=useMemo(()=>new Set(leads.map(item=>item.externalId).filter(Boolean)),[leads]);
  const selectedItems = useMemo(() => places.filter(item => selected.has(item.placeId)), [places, selected]);
  const withoutOwnSite = useMemo(() => places.filter(item => !item.hasOwnSite).length, [places]);

  function updateFilter(field, value) {
    setFilters(current => {
      const next = { ...current, [field]: value };
      if (field === "country") {
        next.city = "";
        next.state = value === "BR" ? "RS" : "";
      }
      if (field === "state") next.city = "";
      if (["country","state","city"].includes(field)) next.neighborhood="";
      return next;
    });
  }

  async function runPlacesSearch(event) {
    event.preventDefault();
    if(searching || addingIds.size) return;
    const snapshot = { ...filters };
    setSearching(true);
    setPlacesNotice("");
    try {
      const result = await searchPlacesAction(snapshot);
      setPlaces(uniquePlaces(result.results || []));
      setSelected(new Set());
      setResultFilters(snapshot);
      setHasSearched(true);
      setResultQuery("");
      setResultPresence("all");
      setPlacesNotice(`${result.count} estabelecimentos encontrados para “${result.query}”.`);
    } catch (error) {
      setPlacesNotice("Erro na busca: " + error.message + (places.length ? " Os resultados anteriores foram preservados." : ""));
    } finally {
      setSearching(false);
    }
  }

  function togglePlace(id) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllPlaces() {
    setSelected(current => resultVisible.every(item=>current.has(item.placeId)) ? new Set([...current].filter(id=>!resultVisible.some(item=>item.placeId===id))) : new Set([...current,...resultVisible.map(item=>item.placeId)]));
  }

  function downloadText(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportBase(format) {
    try {
      if (!visible.length) throw new Error("Nenhum lead está visível para exportar.");
      if (format === "vcf") {
        downloadText(buildLeadsVCard(visible), leadExportFilename("vcf", "base-filtrada"), "text/vcard;charset=utf-8");
      } else {
        downloadText(buildLeadsJson(visible), leadExportFilename("json", "base-filtrada"), "application/json;charset=utf-8");
      }
      setNotice(`${visible.length} leads exportados em ${format === "vcf" ? "vCard" : "JSON"} usando os filtros atuais.`);
    } catch (error) {
      setNotice("Erro ao exportar: " + error.message);
    }
  }

  function exportPlaces(items, scope) {
    try {
      const csv = buildPlacesCsv(items, resultFilters||filters);
      downloadText(csv, placesCsvFilename(resultFilters||filters, scope), "text/csv;charset=utf-8");
      setPlacesNotice(`${items.length} leads exportados em CSV${scope === "selecionados" ? " a partir da seleção" : " a partir da busca"}.`);
    } catch (error) {
      setPlacesNotice("Erro ao exportar: " + error.message);
    }
  }

  async function sendPlacesToCrm(items) {
    if(searching||items.some(item=>addingIds.has(item.placeId)))return;
    const ids = items.map(item => item.placeId);
    setAddingIds(current => new Set([...current, ...ids]));
    setPlacesNotice("");
    try {
      const result = await addPlacesToCrmAction(items);
      setPlacesNotice(`${result.added} novos leads enviados ao CRM · ${result.updated} registros atualizados.${result.warning?" "+result.warning:""}`);
      setSelected(current => {
        const next = new Set(current);
        ids.forEach(id => next.delete(id));
        return next;
      });
      router.refresh();
    } catch (error) {
      setPlacesNotice("Erro ao enviar para o CRM: " + error.message);
    } finally {
      setAddingIds(current => {
        const next = new Set(current);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      const text = decodeSmart(await file.arrayBuffer());
      const result = await importTextAction(text, file.name);
      const coverage = result.coverage;
      setNotice(`${result.recognized} reconhecidos · ${result.added} novos · ${result.updated} atualizados · ${coverage.withWhatsapp} com WhatsApp · ${coverage.withoutContact} sem contato.`);
      router.refresh();
    } catch (error) {
      setNotice("Erro na importação: " + error.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  const cityDisabled = filters.country === "BR" && (loadingCities || !cities.length);

  return <main className={s.page}>
    <header className={s.header}>
      <div><h1>Buscar Leads</h1><p>Encontre empresas automaticamente no Google Maps, exporte os resultados e envie as oportunidades para o CRM.</p></div>
      <div className={s.actions}>
        <a href="/crm">Abrir CRM</a>
        <label className={s.secondary}>{busy ? "Importando…" : "Importar CSV/JSON"}<input type="file" accept=".csv,.json" hidden disabled={busy} onChange={importFile} /></label>
      </div>
    </header>

    <section className={s.searchPanel}>
      <form className={s.searchForm} onSubmit={runPlacesSearch}>
        <label><span>País</span><select value={filters.country} onChange={event => updateFilter("country", event.target.value)}><option value="BR">Brasil</option><option value="PT">Portugal</option><option value="AO">Angola</option><option value="MZ">Moçambique</option></select></label>
        <label><span>Estado / região</span>{filters.country === "BR"
          ? <select value={filters.state} onChange={event => updateFilter("state", event.target.value)}>{STATES.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}</select>
          : <input value={filters.state} onChange={event => updateFilter("state", event.target.value)} placeholder="Região, distrito ou província" />}</label>
        <label><span>Cidade</span>{filters.country === "BR"
          ? <select required disabled={cityDisabled} value={filters.city} onChange={event => updateFilter("city", event.target.value)}><option value="">{loadingCities ? "Carregando cidades…" : citiesError ? "Falha ao carregar cidades" : "Selecione a cidade"}</option>{cities.map(city => <option key={city} value={city}>{city}</option>)}</select>
          : <input required value={filters.city} onChange={event => updateFilter("city", event.target.value)} placeholder="Informe a cidade" />}</label>
        <label><span>Bairro opcional</span><input value={filters.neighborhood} onChange={event => updateFilter("neighborhood", event.target.value)} placeholder="Ex.: Centro" /></label>
        <label><span>Nicho</span><input required list="lead-niches" value={filters.category} onChange={event=>updateFilter("category",event.target.value)} placeholder="Digite ou escolha um nicho"/><datalist id="lead-niches">{CATEGORIES.map(item=><option key={item} value={item}/>)}</datalist></label>
        <button className={s.searchButton} type="submit" disabled={searching || addingIds.size>0 || !filters.city.trim() || !filters.category.trim() || cityDisabled}>{searching ? "Buscando…" : "Buscar"}</button>
      </form>
      {citiesError && filters.country === "BR" && <div className={s.cityError}>Não foi possível carregar as cidades pelo IBGE: {citiesError} <button type="button" onClick={()=>setCitiesRetry(value=>value+1)}>Tentar novamente</button></div>}
      <div className={s.quantityRow}><span>Quantidade</span>{[20, 40, 60].map(value => <button type="button" key={value} className={filters.count === value ? s.quantityActive : ""} onClick={() => updateFilter("count", value)}>{value}</button>)}<small>Até a quantidade escolhida. A disponibilidade depende da cidade e do nicho.</small></div>
    </section>

    {searching&&<div className={s.searchStatus} role="status"><strong>Buscando empresas…</strong><span>A busca pode levar alguns minutos. Os resultados anteriores continuam disponíveis.</span></div>}
    {hasSearched&&!places.length&&!searching&&<div className={s.empty}>Nenhuma empresa encontrada. Tente outro nicho ou remova o bairro.</div>}
    {placesNotice && <div className={placesNotice.startsWith("Erro") ? s.error : s.notice}>{placesNotice}</div>}

    {places.length > 0 && <section className={s.resultsSection}>
      <div className={s.resultContext}><strong>{resultFilters?.category} · {resultFilters?.city} / {resultFilters?.state}</strong><span>Resultados da última busca concluída</span></div>
      <div className={s.resultFilters}><input aria-label="Buscar nos resultados" value={resultQuery} onChange={event=>setResultQuery(event.target.value)} placeholder="Filtrar por nome ou endereço"/><select aria-label="Filtrar resultados" value={resultPresence} onChange={event=>setResultPresence(event.target.value)}><option value="all">Todas as empresas</option><option value="no-site">Sem site próprio</option><option value="phone">Com telefone</option></select><select aria-label="Ordenar resultados" value={resultSort} onChange={event=>setResultSort(event.target.value)}><option value="score">Maior score</option><option value="name">Nome</option><option value="reviews">Mais avaliações</option></select><span>{resultVisible.length} de {places.length} exibidos</span></div>
      <div className={s.resultsHeader}>
        <div><strong>{places.length}</strong><span>resultados</span><strong className={s.opportunityNumber}>{withoutOwnSite}</strong><span>sem site próprio</span></div>
        <div>
          <button type="button" onClick={toggleAllPlaces} disabled={!resultVisible.length}>{resultVisible.length>0&&resultVisible.every(item=>selected.has(item.placeId)) ? "Limpar seleção" : "Selecionar todos"}</button>
          <button type="button" disabled={!resultVisible.length} onClick={() => exportPlaces(resultVisible, "filtrados")}>Exportar CSV ({resultVisible.length})</button>
          <button type="button" disabled={!selectedItems.length} onClick={() => exportPlaces(selectedItems, "selecionados")}>Exportar selecionados ({selectedItems.length})</button>
          <button type="button" className={s.sendSelected} disabled={searching || !selectedItems.length || selectedItems.some(item => addingIds.has(item.placeId))} onClick={() => sendPlacesToCrm(selectedItems)}>Enviar selecionados ({selectedItems.length})</button>
        </div>
      </div>
      {!resultVisible.length&&<div className={s.empty}>Nenhum resultado corresponde ao filtro atual.</div>}
      <div className={s.resultsGrid}>{resultVisible.map(item => <ResultCard key={item.placeId} item={item} checked={selected.has(item.placeId)} onToggle={() => togglePlace(item.placeId)} onAdd={() => sendPlacesToCrm([item])} busy={searching||addingIds.has(item.placeId)} saved={knownIds.has(item.placeId)} />)}</div>
    </section>}

    {notice && <div className={notice.startsWith("Erro") ? s.error : s.notice}>{notice}</div>}
    {counts.total > 0 && counts.whatsapp === 0 && <div className={s.warning}><strong>A base ainda não possui WhatsApp confirmado.</strong><span>A busca automática traz telefone do Google. Celulares são marcados como possível WhatsApp, mas só entram como confirmados depois da sua validação.</span></div>}

    <section className={s.baseHeader}>
      <div><h2>Base local</h2><p>Empresas já salvas, incluindo importações e resultados enviados ao CRM.</p></div>
      <div className={s.baseExportActions}>
        <button type="button" disabled={!visible.length} onClick={() => exportBase("json")}>Exportar JSON</button>
        <button type="button" disabled={!visible.length} onClick={() => exportBase("vcf")}>Exportar contatos</button>
      </div>
    </section>
    <section className={s.stats}>
      <div><span>Total</span><strong>{counts.total}</strong></div>
      <div><span>WhatsApp confirmado</span><strong>{counts.whatsapp}</strong></div>
      <div><span>Com telefone</span><strong>{counts.phone}</strong></div>
      <div><span>Sem contato</span><strong>{counts.noContact}</strong></div>
      <div><span>Sem site próprio</span><strong>{counts.noSite}</strong></div>
    </section>

    <section className={s.panel}>
      <div className={s.filters}>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa, segmento, cidade…" />
        <select value={contact} onChange={event => setContact(event.target.value)}><option value="all">Todos os contatos</option><option value="whatsapp">Com WhatsApp confirmado</option><option value="no-contact">Sem contato</option><option value="no-site">Sem site próprio</option></select>
        <select value={grade} onChange={event => setGrade(event.target.value)}><option value="all">Todas as notas</option>{["A", "B", "C", "D"].map(item => <option key={item} value={item}>Nota {item}</option>)}</select>
        <span>{visible.length} exibidos</span>
      </div>

      <div className={s.tableWrap}>
        <table>
          <thead><tr><th>Empresa</th><th>Local / segmento</th><th>Qualificação</th><th>Contato</th><th>Presença digital</th><th>Etapa</th><th /></tr></thead>
          <tbody>{visible.map(lead => <tr key={lead.id}>
            <td><strong>{lead.name}</strong><small>{lead.source || "Importação"}</small></td>
            <td><span>{lead.city || lead.location || "Não informado"}</span><small>{lead.segment || "Sem segmento"}</small></td>
            <td><span className={`${s.grade} ${s["grade" + lead.grade]}`}>{lead.grade}</span><b className={s.score}>{lead.score}</b></td>
            <td>{lead.whatsapp ? <><b>{lead.whatsapp}</b><small>WhatsApp confirmado</small></> : lead.phone ? <><b>{lead.phone}</b><small>Telefone</small></> : lead.email ? <><b>{lead.email}</b><small>E-mail</small></> : <span className={s.missing}>Não encontrado</span>}</td>
            <td>{lead.site ? <><a href={/^https?:/.test(lead.site) ? lead.site : "http://" + lead.site} target="_blank" rel="noopener noreferrer">Abrir presença</a><small>{lead.weakSite ? "Presença de terceiros ou fraca" : "Site próprio"}</small></> : lead.instagram ? <a href={lead.instagram} target="_blank" rel="noopener noreferrer">Instagram</a> : <span className={s.missing}>Sem site/rede</span>}</td>
            <td><span className={s.stage}>{STAGE_LABEL[lead.stage] || lead.stage}</span></td>
            <td><div className={s.rowActions}>{lead.mapsLink && <a href={lead.mapsLink} target="_blank" rel="noopener noreferrer">Maps</a>}<a href={"/crm/"+lead.id}>Abrir lead</a></div></td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <div className={s.empty}>{counts.total ? "Nenhum lead corresponde aos filtros." : "Faça uma busca automática ou importe um CSV para começar."}</div>}
      </div>
    </section>
  </main>;
}
