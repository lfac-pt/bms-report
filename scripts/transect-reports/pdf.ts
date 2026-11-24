import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "node:fs";
import path from "node:path";
import { TransectReport, SeasonSummary, daysBetween, seasonBounds } from "./model";
import { volunteerCredit, seasonHighlights, visitFrequency } from "./presentation";
import { speciesPhoto, SpeciesPhoto } from "./photos";
import { SpeciesSummary } from "./model";

const INK = "#173F35";
const GREEN = "#24745D";
const MUTED = "#58675F";
const PAPER = "#FAF8F1";
const PALE = "#EAF0E9";
const PARCHMENT = "#F2E8C2";
const BUTTERFLY = fs.readFileSync(path.join(__dirname, "assets/butterfly-engraving.png"));
const TAGIS_LOGO = fs.readFileSync(path.join(__dirname, "assets/tagis-logo.png"));
const EBMS_LOGO = fs.readFileSync(path.join(__dirname, "assets/ebms-logo.png"));
const M = 18;
const W = 174;
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const fmt = (value: number, digits = 0) =>
  value
    .toLocaleString("pt-PT", { maximumFractionDigits: digits, minimumFractionDigits: digits })
    .replace(/\u00a0|\u202f/g, " ");
const date = (value: string) => value.split("-").reverse().join("/");
const shortDate = (value: string) => value.slice(5).split("-").reverse().join("/");
const dayMonth = (value: string) => shortDate(value).replace("/", ".");
const STATUS: Record<string, string> = {
  CR: "Criticamente em Perigo",
  EN: "Em Perigo",
  VU: "Vulnerável",
};

/** Bundled illustration and selectable text; no browser or remote dependencies at runtime. */
export function renderReport(report: TransectReport): Buffer {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  pdf.setProperties({
    title: `${report.name} | Época ${report.current.year}`,
    subject: "Censos de Borboletas de Portugal - Recapitulativo por transecto",
    author: "Relatório de monitorização | BMS Portugal",
    creator: "bms-report / transect-reports",
  });
  let y = 0;
  const [seasonStart, seasonEnd] = seasonBounds(report.current.year, report.window);
  const pagesWithMissingData = new Set<number>();
  const missingData = "s/d";
  function text(value: string, x: number, top: number, size = 10, color = INK, bold = false) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    pdf.text(value, x, top);
  }
  function drawPageHeader() {
    pdf.setFillColor(PAPER);
    pdf.rect(0, 0, 210, 297, "F");
    pdf.setFillColor("#FFFFFF");
    pdf.rect(0, 0, 210, 26, "F");
    text(`CENSOS DE BORBOLETAS  |  RELATÓRIO ANUAL ${report.current.year}`, M, 16, 8, GREEN, true);
    pdf.addImage(TAGIS_LOGO, "PNG", 135, 4, (17 * 118) / 112, 17, "tagis-logo");
    pdf.addImage(EBMS_LOGO, "PNG", 157, 3.5, (19 * 1174) / 614, 19, "ebms-logo");
    pdf.setDrawColor("#D8DFD3");
    pdf.line(M, 26, 192, 26);
  }
  function page() {
    if (y > 0) pdf.addPage();
    drawPageHeader();
    y = 37;
  }
  function ensure(height: number) {
    if (y + height > 274) page();
  }
  function paragraph(value: string, size = 10, color = MUTED) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(value, W);
    const lineHeight = size * 0.46;
    if (lines.length * lineHeight + 4 < 237) ensure(lines.length * lineHeight + 4);
    for (const line of lines) {
      ensure(lineHeight + 2);
      text(line, M, y, size, color);
      y += lineHeight;
    }
    y += 4;
  }
  function section(kicker: string, title: string) {
    ensure(30);
    y += 4;
    text(kicker.toUpperCase(), M, y, 8, GREEN, true);
    y += 8;
    text(title, M, y, 18, INK, true);
    y += 9;
  }
  function table(headers: string[], rows: string[][], widths?: number[], flightCharts = false) {
    ensure(22);
    const seasonDays = daysBetween(seasonStart, seasonEnd) + 1;
    const fraction = (day: string) => daysBetween(seasonStart, day) / seasonDays;
    const months = report.monthly.map(month => {
      const start = `${month.month}-01` < seasonStart ? seasonStart : `${month.month}-01`;
      const nextMonth = new Date(
        Date.UTC(Number(month.month.slice(0, 4)), Number(month.month.slice(5)), 1)
      )
        .toISOString()
        .slice(0, 10);
      const end = nextMonth > seasonEnd ? 1 : fraction(nextMonth);
      return { label: MONTHS[Number(month.month.slice(5)) - 1], start: fraction(start), end };
    });
    autoTable(pdf, {
      startY: y,
      head: [headers],
      body: rows,
      margin: { top: 34, bottom: 24, left: M, right: M },
      tableWidth: W,
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 1.8,
        textColor: INK,
        lineColor: "#DEE4D9",
        lineWidth: { bottom: 0.15 },
        overflow: "linebreak",
        minCellHeight: flightCharts ? 7.8 : 0,
      },
      headStyles: {
        fillColor: INK,
        textColor: "#FFFFFF",
        fontStyle: "bold",
        fontSize: 8,
        minCellHeight: flightCharts ? 13 : 0,
      },
      alternateRowStyles: { fillColor: PALE },
      columnStyles: widths
        ? Object.fromEntries(widths.map((width, index) => [index, { cellWidth: width }]))
        : {},
      rowPageBreak: "avoid",
      didParseCell: data => {
        if (flightCharts && data.section === "head" && data.column.index === 3) data.cell.text = [];
      },
      didDrawCell: data => {
        if (data.section === "body" && data.cell.raw === missingData) {
          pagesWithMissingData.add(pdf.getNumberOfPages());
        }
        if (!flightCharts || data.column.index !== 3) return;
        const { cell } = data;
        const chartX = cell.x + 2;
        const chartWidth = cell.width - 4;
        if (data.section === "head") {
          text("Voo observado", chartX, cell.y + 4, 8, "#FFFFFF", true);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          months.forEach(month =>
            pdf.text(
              month.label,
              chartX + ((month.start + month.end) / 2) * chartWidth,
              cell.y + 10,
              { align: "center" }
            )
          );
          return;
        }
        if (data.section !== "body") return;
        const species = report.species[data.row.index];
        const peak = Math.max(0, ...species.weeklyMean.map(value => value || 0));
        const base = cell.y + cell.height - 1.4;
        const height = cell.height - 3;
        report.weekly.forEach((bin, index) => {
          const x = chartX + fraction(bin.start) * chartWidth;
          const width = ((daysBetween(bin.start, bin.end) + 1) / seasonDays) * chartWidth;
          const value = species.weeklyMean[index];
          if (value === null) {
            pdf.setFillColor("#DCE1D8");
            pdf.rect(x + 0.1, base - height, Math.max(0.1, width - 0.2), height, "F");
          } else if (value > 0 && peak > 0) {
            const barHeight = Math.max(0.4, (value / peak) * height);
            pdf.setFillColor(GREEN);
            pdf.rect(x + width * 0.12, base - barHeight, width * 0.76, barHeight, "F");
          }
        });
        pdf.setDrawColor("#BBC7B7");
        pdf.setLineWidth(0.15);
        pdf.line(chartX, base, chartX + chartWidth, base);
        months.slice(1).forEach(month => {
          const x = chartX + month.start * chartWidth;
          pdf.line(x, base - height, x, base);
        });
      },
      willDrawPage: data => {
        if (data.pageNumber > 1) drawPageHeader();
      },
    });
    y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }
  function photoCards(items: { species: SpeciesSummary; photo: SpeciesPhoto }[]) {
    const width = (W - 6) / 2;
    for (let index = 0; index < items.length; index += 2) {
      const row = items.slice(index, index + 2).map(item => {
        const data = fs.readFileSync(item.photo.filename);
        const image = pdf.getImageProperties(data);
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(12);
        const names: string[] = pdf.splitTextToSize(item.species.name, width - 8);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        const credit = item.photo.credit;
        const credits: string[] = pdf.splitTextToSize(
          credit ? `Foto: ${credit.photographer}` : "Fotografia do arquivo do projeto",
          width - 8
        );
        return {
          ...item,
          data,
          image,
          names,
          credits,
          height:
            86 + (names.length - 1) * 5 + (credits.length - 1) * 3.5 + (credit?.license ? 5 : 0),
        };
      });
      const height = Math.max(...row.map(item => item.height));
      ensure(height + 6);
      row.forEach((item, column) => {
        const x = M + column * (width + 6);
        pdf.setFillColor(PALE);
        pdf.roundedRect(x, y - 2, width, height, 2, 2, "F");
        const scale = Math.min((width - 8) / item.image.width, 50 / item.image.height);
        const imageWidth = item.image.width * scale;
        const imageHeight = item.image.height * scale;
        pdf.addImage(
          item.data,
          "JPEG",
          x + (width - imageWidth) / 2,
          y + 2 + (50 - imageHeight) / 2,
          imageWidth,
          imageHeight
        );
        let caption = y + 60;
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(12);
        pdf.setTextColor(INK);
        item.names.forEach(line => {
          pdf.text(line, x + 4, caption);
          caption += 5;
        });
        const badges = [
          item.species.isNew ? "Nova no transecto" : "",
          item.species.statusPT
            ? `${item.species.statusPT} - ${STATUS[item.species.statusPT]}`
            : "",
        ]
          .filter(Boolean)
          .join(" / ");
        text(badges, x + 4, caption, 8, GREEN, true);
        caption += 6;
        text(
          `${fmt(item.species.individuals)} ${item.species.individuals === 1 ? "indivíduo" : "indivíduos"} / ${item.species.visits} ${item.species.visits === 1 ? "visita" : "visitas"}`,
          x + 4,
          caption,
          9
        );
        caption += 5;
        text(`Primeiro registo: ${date(item.species.firstDate)}`, x + 4, caption, 8, MUTED);
        caption += 5;
        item.credits.forEach(line => {
          text(line, x + 4, caption, 7, MUTED);
          caption += 3.5;
        });
        const credit = item.photo.credit;
        if (credit?.url)
          pdf.link(
            x + 4,
            caption - item.credits.length * 3.5 - 3,
            width - 8,
            item.credits.length * 3.5,
            { url: credit.url }
          );
        if (credit?.license) {
          text(credit.license, x + 4, caption, 7, MUTED);
          if (credit.licenseUrl || credit.url)
            pdf.link(x + 4, caption - 3, width - 8, 4, { url: credit.licenseUrl || credit.url! });
        }
      });
      y += height + 4;
    }
  }

  page();
  // A natural-history plate: warm paper, dark type and a delicate sepia engraving.
  pdf.setFillColor(PARCHMENT);
  pdf.rect(0, 29, 210, 72, "F");
  text(`O SEU TRANSECTO  /  ÉPOCA ${report.current.year}`, M, 41, 9, GREEN, true);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(25);
  let titleSize = 25;
  let titles: string[] = pdf.splitTextToSize(report.name, 137);
  let volunteerSize = 10;
  const volunteerLabel = volunteerCredit(report.volunteers);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(volunteerSize);
  let volunteerLines: string[] = volunteerLabel ? pdf.splitTextToSize(volunteerLabel, 137) : [];
  while (volunteerLines.length > 3 && volunteerSize > 8) {
    volunteerSize--;
    pdf.setFontSize(volunteerSize);
    volunteerLines = pdf.splitTextToSize(volunteerLabel, 137);
  }
  const volunteerContinuation = volunteerLines.slice(3).join(" ");
  volunteerLines = volunteerLines.slice(0, 3);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(titleSize);
  const titleHeight = volunteerLines.length
    ? 30 - volunteerLines.length * volunteerSize * 0.44
    : 34;
  while (titles.length * titleSize * 0.42 > titleHeight && titleSize > 10) {
    titleSize--;
    pdf.setFontSize(titleSize);
    titles = pdf.splitTextToSize(report.name, 137);
  }
  titles.forEach((line, i) => text(line, M, 54 + i * (titleSize * 0.42), titleSize, INK, true));
  const volunteerTop = 54 + (titles.length - 1) * titleSize * 0.42 + 8;
  volunteerLines.forEach((line, i) =>
    text(line, M, volunteerTop + i * volunteerSize * 0.44, volunteerSize, MUTED)
  );
  text(
    `${report.municipality || "Portugal"}  |  ${shortDate(seasonStart)} a ${date(seasonEnd)}`,
    M,
    93,
    9,
    MUTED
  );
  pdf.addImage(BUTTERFLY, "PNG", 154, 46, 51, 34, "butterfly-engraving", "SLOW");
  y = 112;
  const meanPerVisit = report.current.meanPerVisit;
  if (meanPerVisit === null) pagesWithMissingData.add(1);
  const metrics = [
    [fmt(report.current.visits), "VISITAS"],
    [fmt(report.current.speciesCount), "ESPÉCIES"],
    [fmt(report.current.individuals), "INDIVÍDUOS"],
    [meanPerVisit === null ? missingData : fmt(meanPerVisit, 1), "Nº MÉDIO INDIVÍDUOS/VISITA"],
  ];
  metrics.forEach(([value, label], index) => {
    const x = M + index * 45;
    text(value, x, y, 23, INK, true);
    text(label, x, y + 7, 7.5, MUTED, true);
  });
  y = 134;
  paragraph(
    "Obrigado por dar tempo às borboletas. Cada visita contribui para os projetos Censos de Borboletas de Portugal e European Butterfly Monitoring Scheme, ajudando a conhecer melhor as espécies e os seus habitats.",
    10,
    INK
  );
  section("01 / Ritmo da época", "Borboletas ao longo dos meses");
  paragraph("Média de indivíduos por visita. Os meses sem visita (s/v) ficam sem estimativa.", 9);
  const chartTop = y + 3;
  const chartHeight = 30;
  const max = Math.max(1, ...report.monthly.map(month => month.mean || 0));
  const slot = W / report.monthly.length;
  report.monthly.forEach((month, i) => {
    const x = M + slot * i + 3;
    const width = Math.min(16, slot - 6);
    const height = ((month.mean || 0) / max) * chartHeight;
    pdf.setFillColor(GREEN);
    if (height) pdf.rect(x, chartTop + chartHeight - height, width, height, "F");
    text(
      month.mean === null ? "s/v" : fmt(month.mean, 1),
      x,
      chartTop + chartHeight - height - 2,
      8,
      month.mean === null ? MUTED : GREEN
    );
    text(MONTHS[Number(month.month.slice(5)) - 1], x, chartTop + chartHeight + 6, 8, INK, true);
    text(`${month.visits} vis.`, x, chartTop + chartHeight + 12, 7, MUTED);
  });
  y = chartTop + chartHeight + 24;
  const newSpecies = report.species.filter(item => item.isNew);
  const threatened = report.species.filter(item =>
    ["VU", "EN", "CR"].includes(item.statusPT || "")
  );
  const internalGaps = report.gaps.filter(gap => gap.kind === "between");
  paragraph(seasonHighlights(report).join(" "), 9, INK);

  page();
  if (volunteerContinuation) {
    paragraph(volunteerContinuation, 9);
  }
  section("02 / Continuidade", "Cada visita conta");
  paragraph(
    report.current.dates.length
      ? report.current.dates.length === 1
        ? `${fmt(report.current.visits)} ${report.current.visits === 1 ? "visita realizada" : "visitas realizadas"} em ${date(report.current.dates[0])}.`
        : `${fmt(report.current.visits)} visitas realizadas de ${date(report.current.dates[0])} a ${date(report.current.dates[report.current.dates.length - 1])}.`
      : "Não existem visitas na janela escolhida. A ausência de visitas não significa ausência de borboletas."
  );
  const frequency = visitFrequency(report);
  ensure(57);
  pdf.setFillColor(PALE);
  pdf.roundedRect(M, y - 3, W, 43, 2, 2, "F");
  text("PAUSAS ENTRE VISITAS", M + 4, y + 2, 8, GREEN, true);
  text(frequency.label, M + 4, y + 10, 14, INK, true);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  const frequencyLines: string[] = pdf.splitTextToSize(frequency.message, W - 8);
  frequencyLines.forEach((line, i) => text(line, M + 4, y + 16 + i * 4, 9, MUTED));
  const frequencyLabels = ["Reforçar a equipa", "Ganhar ritmo", "Bom ritmo", "Fantástico"];
  const frequencyThresholds = ["Mais de 28 dias", "22-28 dias", "15-21 dias", "Até 14 dias"];
  const segmentWidth = (W - 17) / 4;
  frequencyLabels.forEach((label, i) => {
    const x = M + 4 + i * (segmentWidth + 3);
    const active = i === frequency.level;
    text(frequencyThresholds[i], x, y + 25, 7, active ? INK : MUTED, active);
    pdf.setFillColor(active ? GREEN : "#D3DDD1");
    pdf.roundedRect(x, y + 28, segmentWidth, active ? 3 : 2, 0.7, 0.7, "F");
    text(label, x, y + 37, 7.5, active ? INK : MUTED, active);
  });
  y += 47;
  paragraph(
    `Maior pausa na época: ${frequency.longestGapDays} dias, considerando todo o período de monitorização (${dayMonth(seasonStart)} a ${dayMonth(seasonEnd)}).`,
    8
  );
  table(
    ["Mês", "Visitas", "Espécies", "Indivíduos / visita"],
    report.monthly.map(month => [
      MONTHS[Number(month.month.slice(5)) - 1],
      fmt(month.visits),
      month.visits ? fmt(month.species) : missingData,
      month.mean === null ? missingData : fmt(month.mean, 1),
    ]),
    [40, 32, 35, 67]
  );
  section(
    "Continuidade ao longo da época",
    report.gaps.length
      ? "Onde reforçar as visitas"
      : frequency.level === 3
        ? "Uma regularidade exemplar"
        : "Continuar a acompanhar a época"
  );
  if (report.gaps.length) {
    paragraph(
      "São sinalizados os períodos com pausas superiores a 14 dias. As pausas antes da primeira visita e depois da última são indicadas separadamente.",
      9
    );
    const kinds = {
      between: "Entre visitas",
      start: "Início da época",
      end: "Fim da época",
      "whole-season": "Época sem visitas",
    };
    table(
      ["De", "Até", "Dias", "Tipo"],
      report.gaps.map(gap => [date(gap.from), date(gap.to), String(gap.days), kinds[gap.kind]]),
      [39, 39, 22, 74]
    );
  } else if (frequency.level === 3)
    paragraph(
      "Parabéns pela regularidade. Acompanhou toda a época sem pausas superiores a duas semanas.",
      10,
      GREEN
    );
  else paragraph("Continue a registar visitas para acompanhar a época e avaliar a regularidade.");
  ensure(21 + Math.min(report.history.length + 2, 10) * 7.3 + 8);
  section("03 / Perspetiva", "Comparação com os anos anteriores");
  const seasonRow = (season: SeasonSummary) => [
    String(season.year),
    fmt(season.visits),
    fmt(season.speciesCount),
    fmt(season.individuals),
    season.meanPerVisit === null ? missingData : fmt(season.meanPerVisit, 1),
  ];
  if (report.history.length) {
    table(
      ["Ano", "Visitas", "Espécies", "Indivíduos", "Indivíduos / visita"],
      [report.current, ...report.history.slice().reverse()].map(seasonRow)
    );
    const previous = report.history[report.history.length - 1];
    if (previous.meanPerVisit && report.current.meanPerVisit !== null) {
      const change = (report.current.meanPerVisit / previous.meanPerVisit - 1) * 100;
      paragraph(
        `Face a ${previous.year}, o número médio de indivíduos por visita ${change >= 0 ? "aumentou" : "diminuiu"} ${fmt(Math.abs(change), 1)}%. Trata-se de uma comparação descritiva, sensível às datas, ao clima e ao esforço de amostragem.`,
        9
      );
    }
  } else paragraph("Ainda não há uma época anterior com visitas na mesma janela para comparar.");
  paragraph(
    "Aplica-se a mesma janela de datas a todos os anos. A média por visita ajuda a contextualizar o esforço, mas não é um índice de abundância nem uma tendência populacional. Anos sem visitas não são tratados como anos com zero borboletas.",
    9
  );

  section("04 / Descobertas", "O que merece um olhar mais atento");
  if (report.firstSeason)
    paragraph(
      "Na primeira época disponível não se classificam espécies como novas. Os registos deste ano passam a ser a referência local."
    );
  else if (newSpecies.length) {
    paragraph(
      "Primeiros registos disponíveis neste transecto face a todos os anos anteriores. Não implicam uma colonização recente ou uma novidade nacional.",
      9
    );
  } else
    paragraph(
      "Todas as espécies observadas já tinham registos em anos anteriores neste transecto."
    );
  if (!threatened.length)
    paragraph("Este ano, não observou espécies consideradas ameaçadas em Portugal continental.", 9);
  const illustrated = report.species
    .filter(species => species.isNew || threatened.some(item => item.name === species.name))
    .map(species => ({ species, photo: speciesPhoto(species.name) }))
    .filter(
      (item): item is { species: SpeciesSummary; photo: SpeciesPhoto } => item.photo !== null
    );
  if (illustrated.length) photoCards(illustrated);
  const illustratedNames = new Set(illustrated.map(item => item.species.name));
  const remainingDiscoveries = newSpecies.filter(item => !illustratedNames.has(item.name));
  const remainingThreatened = threatened.filter(item => !illustratedNames.has(item.name));
  if (remainingDiscoveries.length) {
    table(
      ["Espécie nova no histórico local", "Indivíduos", "Primeira observação"],
      remainingDiscoveries.map(item => [item.name, fmt(item.individuals), date(item.firstDate)]),
      [89, 30, 55]
    );
  }
  if (remainingThreatened.length) {
    table(
      ["Espécie", "Estatuto em Portugal continental", "Indivíduos"],
      remainingThreatened.map(item => [
        item.name,
        `${item.statusPT} - ${STATUS[item.statusPT!]}`,
        fmt(item.individuals),
      ]),
      [76, 70, 28]
    );
  }
  // Keep the inventory title, its legend and the first few chart rows on the same page.
  ensure(report.species.length ? 83 : 35);
  section("05 / Caderno de campo", "Todas as espécies da época");
  if (report.species.length) {
    paragraph(
      "As espécies são apresentadas por ordem decrescente de abundância. A abundância é o número total de indivíduos registados ao longo da época. A mesma espécie pode ser contada em visitas diferentes. A frequência indica em quantas visitas a espécie foi observada, face ao total.",
      8
    );
    paragraph(
      "Barras semanais: média de indivíduos por visita, com altura ajustada ao pico de cada espécie. Cinzento: semanas sem visitas.",
      8
    );
    table(
      ["Espécie", "Abundância", "Frequência", "Voo observado", "Destaque"],
      report.species.map(item => [
        item.name,
        fmt(item.individuals),
        `${item.visits}/${report.current.visits}`,
        "",
        [item.isNew ? "Nova" : "", item.statusPT || ""].filter(Boolean).join(" / ") || "-",
      ]),
      [48, 23, 19, 65, 19],
      true
    );
  } else paragraph("Não há contagens positivas de espécies reconhecidas na janela escolhida.");

  ensure(75);
  section("06 / Próxima época", "Continuar a construir este retrato");
  if (report.peak && report.peak.individuals > 0)
    paragraph(
      `O dia de maior abundância foi ${date(report.peak.date)}, com ${fmt(report.peak.individuals)} ${report.peak.individuals === 1 ? "indivíduo registado" : "indivíduos registados"}.`,
      10,
      INK
    );
  paragraph(
    internalGaps.length
      ? "Tente reforçar as visitas nos períodos com intervalos longos, com boas condições meteorológicas. Confirme os registos pendentes e anote alterações no habitat ou cortes de vegetação."
      : "Mantenha a regularidade e registe também as visitas sem borboletas. Confirme os registos pendentes e anote alterações no habitat ou cortes de vegetação."
  );
  paragraph(
    volunteerLabel ? `Muito obrigada, ${volunteerLabel}!` : "Muito obrigada pela sua participação!",
    12,
    INK
  );
  paragraph(
    `Esperamos contar ${report.volunteers.length > 1 ? "convosco" : "consigo"} na abertura da época de ${report.current.year + 1}!`,
    10,
    INK
  );

  const count = pdf.getNumberOfPages();
  for (let p = 1; p <= count; p++) {
    pdf.setPage(p);
    pdf.setDrawColor("#D8DFD3");
    pdf.line(M, 280, 192, 280);
    if (pagesWithMissingData.has(p)) text(`${missingData} - sem dados`, M, 286, 7, MUTED);
    text(`${p} / ${count}`, 181, 286, 8, INK);
  }
  return Buffer.from(pdf.output("arraybuffer"));
}
