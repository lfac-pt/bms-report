import { daysBetween, seasonBounds, TransectReport } from "./model";

export function volunteerCredit(names: string[]): string {
  if (!names.length) return "";
  return `${names.length === 1 ? "Voluntário" : "Voluntários"}: ${names.join("; ")}`;
}

/** A supportive coverage indicator, using the reporting window rather than just the busy period. */
export function visitFrequency(report: TransectReport) {
  const [start, end] = seasonBounds(report.current.year, report.window);
  const dates = [...new Set(report.current.dates)].sort();
  const boundaries = [start, ...dates, end];
  const longestGapDays = Math.max(
    ...boundaries.slice(1).map((date, i) => daysBetween(boundaries[i], date))
  );
  const level =
    dates.length < 2
      ? null
      : longestGapDays <= 14
        ? 3
        : longestGapDays <= 21
          ? 2
          : longestGapDays <= 28
            ? 1
            : 0;
  const labels = [
    "Vamos reforçar a equipa?",
    "Vamos ganhar ritmo",
    "Bom ritmo",
    "Fantástico, continue assim!",
  ];
  const messages = [
    "Partilhar as visitas com outra pessoa pode ajudar a acompanhar toda a época.",
    "Tente encurtar as pausas entre visitas, sempre que as condições o permitam.",
    "Está no bom caminho. Procure manter as visitas a cada duas semanas.",
    "Acompanhou toda a época sem pausas superiores a duas semanas. Obrigado pela dedicação.",
  ];
  return {
    level,
    longestGapDays,
    label: level === null ? "Vamos construir este ritmo" : labels[level],
    message:
      level === null
        ? "Precisamos de visitas em pelo menos duas datas para avaliar a regularidade."
        : messages[level],
  };
}

export function seasonHighlights(report: TransectReport): string[] {
  const discoveries = report.species.filter(species => species.isNew).length;
  const threatened = report.species.filter(species =>
    ["CR", "EN", "VU"].includes(species.statusPT || "")
  ).length;
  const gaps = report.gaps.filter(gap => gap.kind === "between").length;
  const lines: string[] = [];
  if (report.firstSeason)
    lines.push(
      "A sua primeira época é o início de uma história: obrigado por se juntar aos Censos."
    );
  else if (discoveries)
    lines.push(
      `Este ano, registou ${discoveries} ${discoveries === 1 ? "nova espécie" : "novas espécies"} no seu transecto.`
    );
  if (threatened)
    lines.push(
      `Registou ${threatened} ${threatened === 1 ? "espécie ameaçada" : "espécies ameaçadas"} em Portugal continental.`
    );
  if (visitFrequency(report).level === 3)
    lines.push("Excelente regularidade: nenhuma pausa superior a 14 dias entre visitas.");
  else if (report.current.dates.length >= 2 && !gaps)
    lines.push(
      "As visitas mantiveram intervalos de até 14 dias. Na próxima época, procure também acompanhar o início e o fim da temporada."
    );
  else if (gaps)
    lines.push(
      `Houve ${gaps === 1 ? "uma pausa superior" : `${gaps} pausas superiores`} a 14 dias. Partilhar as visitas pode ajudar a manter o ritmo.`
    );
  if (report.municipalityTransectCount === 1 && report.municipality.trim())
    lines.push(
      `O seu é o único transecto dos Censos registado no concelho de ${report.municipality.trim()}. O seu contributo faz a diferença.`
    );
  return lines;
}
