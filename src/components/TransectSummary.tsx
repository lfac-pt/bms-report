import React from "react";
import { Card, Typography } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import { Dataset } from "../types/dataset";
import {
  getAllSpecies,
  getTransectFirstObservationDate,
  getTransectYearsOfOperation,
  getAverageVisitsPerYear,
  getNewSpeciesCount,
  getAverageAbundancyForYear,
  getMostFrequentSpecies,
  getMostAbundantSpecies,
  getBestMonthForFrequency,
  getBestMonthForAbundancy,
} from "./utils";

const { Paragraph, Text } = Typography;

interface TransectSummaryProps {
  dataset: Dataset;
  selectedYears: number[];
  targetTransect: string | null;
  targetSection: string | null;
  targetTransectName: string | null;
}

function TransectSummary({
  dataset,
  selectedYears,
  targetTransect,
  targetSection,
  targetTransectName,
}: TransectSummaryProps) {
  // Filter dataset by transect and section
  const filteredDataset = dataset.filter(entry => {
    const matchesTransect = !targetTransect || entry["Transect ID"] === targetTransect;
    const matchesSection = !targetSection || entry["Section Name"] === targetSection;
    return matchesTransect && matchesSection;
  });

  // If no data, don't render anything
  if (filteredDataset.length === 0 || selectedYears.length === 0) {
    return null;
  }

  // Get basic metrics
  const totalSpecies = getAllSpecies(filteredDataset).length;
  const firstObservationDate = getTransectFirstObservationDate(dataset, targetTransect, targetSection);
  const yearsOfOperation = getTransectYearsOfOperation(dataset, targetTransect, targetSection);
  const avgVisitsPerYear = getAverageVisitsPerYear(dataset, targetTransect, targetSection);

  // Get current and previous year for comparisons
  const sortedYears = [...selectedYears].sort((a, b) => b - a); // Descending order
  const currentYear = sortedYears[0];
  const previousYear = sortedYears.length > 1 ? sortedYears[1] : null;

  // New species in current year
  const newSpeciesCount = getNewSpeciesCount(dataset, currentYear, targetTransect, targetSection);

  // Average abundancy comparison
  const currentAvgAbundancy = getAverageAbundancyForYear(
    dataset,
    currentYear,
    targetTransect,
    targetSection
  );
  const previousAvgAbundancy = previousYear
    ? getAverageAbundancyForYear(dataset, previousYear, targetTransect, targetSection)
    : null;

  // Most frequent species
  const currentMostFrequent = getMostFrequentSpecies(
    dataset,
    currentYear,
    targetTransect,
    targetSection
  );
  const previousMostFrequent = previousYear
    ? getMostFrequentSpecies(dataset, previousYear, targetTransect, targetSection)
    : null;

  // Most abundant species
  const currentMostAbundant = getMostAbundantSpecies(
    dataset,
    currentYear,
    targetTransect,
    targetSection
  );
  const previousMostAbundant = previousYear
    ? getMostAbundantSpecies(dataset, previousYear, targetTransect, targetSection)
    : null;

  // Best months
  const currentBestMonthFreq = getBestMonthForFrequency(
    dataset,
    currentYear,
    targetTransect,
    targetSection
  );
  const currentBestMonthAbund = getBestMonthForAbundancy(
    dataset,
    currentYear,
    targetTransect,
    targetSection
  );
  const previousBestMonthFreq = previousYear
    ? getBestMonthForFrequency(dataset, previousYear, targetTransect, targetSection)
    : null;
  const previousBestMonthAbund = previousYear
    ? getBestMonthForAbundancy(dataset, previousYear, targetTransect, targetSection)
    : null;

  // Build summary text
  const transectName = targetTransectName || targetTransect || "o transecto";

  // Paragraph 1: Basic info
  const paragraph1 = `O transecto ${transectName} conta com ${totalSpecies} espécies registadas desde ${firstObservationDate}, estando em funcionamento há ${yearsOfOperation} temporadas de monitorização, com uma média de ${avgVisitsPerYear.toFixed(1)} visitas por temporada.`;

  // Paragraph 2: New species
  let paragraph2: React.ReactNode = "";
  if (previousYear) {
    paragraph2 = `Em ${currentYear}, foram encontradas ${newSpeciesCount} espécies novas em comparação com ${previousYear}.`;
  } else {
    paragraph2 = `Em ${currentYear}, foram encontradas ${newSpeciesCount} espécies novas.`;
  }

  // Paragraph 3: Average abundancy
  let paragraph3: React.ReactNode = "";
  if (previousAvgAbundancy !== null) {
    const abundancyChange = currentAvgAbundancy - previousAvgAbundancy;
    const percentChange = ((abundancyChange / previousAvgAbundancy) * 100).toFixed(0);
    const changeDirection = abundancyChange > 0 ? "aumento" : "diminuição";
    const changeIcon =
      abundancyChange > 0 ? (
        <ArrowUpOutlined style={{ color: "green" }} />
      ) : (
        <ArrowDownOutlined style={{ color: "red" }} />
      );

    paragraph3 = (
      <>
        A abundância média foi de{" "}
        <Text strong>{currentAvgAbundancy.toFixed(1)} indivíduos por visita</Text> (ano anterior:{" "}
        {previousAvgAbundancy.toFixed(1)}, {changeDirection} de{" "}
        {Math.abs(parseFloat(percentChange))}% {changeIcon}).
      </>
    );
  } else {
    paragraph3 = `A abundância média foi de ${currentAvgAbundancy.toFixed(1)} indivíduos por visita.`;
  }

  // Paragraph 4: Most frequent species
  let paragraph4: React.ReactNode = "";
  if (currentMostFrequent) {
    if (previousMostFrequent) {
      paragraph4 = (
        <>
          A espécie mais frequente foi <Text italic>{currentMostFrequent.species}</Text> (
          {currentMostFrequent.frequency.toFixed(0)}%), no ano anterior foi{" "}
          <Text italic>{previousMostFrequent.species}</Text> (
          {previousMostFrequent.frequency.toFixed(0)}%).
        </>
      );
    } else {
      paragraph4 = (
        <>
          A espécie mais frequente foi <Text italic>{currentMostFrequent.species}</Text> (
          {currentMostFrequent.frequency.toFixed(0)}%).
        </>
      );
    }
  }

  // Paragraph 5: Most abundant species
  let paragraph5: React.ReactNode = "";
  if (currentMostAbundant) {
    if (previousMostAbundant) {
      paragraph5 = (
        <>
          A espécie mais abundante foi <Text italic>{currentMostAbundant.species}</Text> (
          {currentMostAbundant.abundance} indivíduos), no ano anterior foi{" "}
          <Text italic>{previousMostAbundant.species}</Text> ({previousMostAbundant.abundance}{" "}
          indivíduos).
        </>
      );
    } else {
      paragraph5 = (
        <>
          A espécie mais abundante foi <Text italic>{currentMostAbundant.species}</Text> (
          {currentMostAbundant.abundance} indivíduos).
        </>
      );
    }
  }

  // Paragraph 6: Best months
  let paragraph6 = "";
  if (currentBestMonthFreq && currentBestMonthAbund) {
    if (previousBestMonthFreq && previousBestMonthAbund) {
      paragraph6 = `O melhor mês para diversidade foi ${currentBestMonthFreq.month} (${currentBestMonthFreq.speciesCount} espécies) e para abundância foi ${currentBestMonthAbund.month} (${currentBestMonthAbund.abundance.toFixed(1)} indivíduos/visita). No ano anterior: ${previousBestMonthFreq.month} (${previousBestMonthFreq.speciesCount} espécies) e ${previousBestMonthAbund.month} (${previousBestMonthAbund.abundance.toFixed(1)} indivíduos/visita), respectivamente.`;
    } else {
      paragraph6 = `O melhor mês para diversidade foi ${currentBestMonthFreq.month} (${currentBestMonthFreq.speciesCount} espécies) e para abundância foi ${currentBestMonthAbund.month} (${currentBestMonthAbund.abundance.toFixed(1)} indivíduos/visita).`;
    }
  }

  return (
    <Card title="Sumário" size="small">
      <div data-chart-export data-export-as-text data-chart-export-title="Sumário">
        <Paragraph className="paragraph">{paragraph1}</Paragraph>
        <Paragraph className="paragraph">{paragraph2}</Paragraph>
        <Paragraph className="paragraph">{paragraph3}</Paragraph>
        {paragraph4 && <Paragraph className="paragraph">{paragraph4}</Paragraph>}
        {paragraph5 && <Paragraph className="paragraph">{paragraph5}</Paragraph>}
        {paragraph6 && <Paragraph className="paragraph">{paragraph6}</Paragraph>}
      </div>
    </Card>
  );
}

export default TransectSummary;
