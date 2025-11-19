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
  endangeredSpeciesSummary,
} from "../utils/utils";
import { DatasetType } from "../utils/datasetAdapter";

const { Paragraph, Text } = Typography;

interface TransectSummaryProps {
  dataset: Dataset;
  selectedYears: number[];
  targetTransect: string | null;
  targetSection: string | null;
  targetTransectName: string | null;
  datasetType: DatasetType;
}

function TransectSummary({
  dataset,
  selectedYears,
  targetTransect,
  targetSection,
  targetTransectName,
  datasetType,
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
  const firstObservationDate = getTransectFirstObservationDate(filteredDataset);
  const yearsOfOperation = getTransectYearsOfOperation(filteredDataset);
  const avgVisitsPerYear = getAverageVisitsPerYear(filteredDataset);

  // Get current and previous year for comparisons
  const sortedYears = [...selectedYears].sort((a, b) => b - a); // Descending order
  const currentYear = sortedYears[0];
  const previousYear = sortedYears.length > 1 ? sortedYears[1] : null;

  // New species in current year
  const newSpeciesCount = getNewSpeciesCount(filteredDataset, currentYear);

  // Average abundancy comparison
  const currentAvgAbundancy = getAverageAbundancyForYear(
    filteredDataset,
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
  const locationLabel = datasetType === "nocturnal" ? "A estação" : "O transecto";
  const locationArticle = datasetType === "nocturnal" ? "a" : "o";
  const transectName =
    targetTransectName ||
    targetTransect ||
    `${locationArticle} ${datasetType === "nocturnal" ? "estação" : "transecto"}`;
  const visitLabel = datasetType === "nocturnal" ? "sessões" : "visitas";
  const visitSingular = datasetType === "nocturnal" ? "sessão" : "visita";

  // Paragraph 1: Basic info
  const paragraph1 = `${locationLabel} ${transectName} conta com ${totalSpecies} espécies registadas desde ${firstObservationDate}, estando em funcionamento há ${yearsOfOperation} temporadas de monitorização, com uma média de ${avgVisitsPerYear.toFixed(1)} ${visitLabel} por temporada.`;

  // Paragraph 2: Endangered species
  const endangeredSpecies = endangeredSpeciesSummary(filteredDataset);
  let paragraph2: React.ReactNode = "";
  if (endangeredSpecies.length > 0) {
    const speciesList = endangeredSpecies.map((item: any, index: number) => {
      const geoLabel = item.geo === "pt" ? "PT" : "UE";
      return (
        <React.Fragment key={item.species}>
          {index > 0 && (index === endangeredSpecies.length - 1 ? " e " : ", ")}
          <Text italic>{item.species}</Text> ({item.status} - {geoLabel})
        </React.Fragment>
      );
    });

    const locationText = datasetType === "nocturnal" ? "Nesta estação" : "Neste transeto";
    paragraph2 = (
      <>
        {locationText} foram registadas {endangeredSpecies.length} espécie
        {endangeredSpecies.length > 1 ? "s" : ""} ameaçada{endangeredSpecies.length > 1 ? "s" : ""}:{" "}
        {speciesList}.
      </>
    );
  }

  // Paragraph 3: New species
  let paragraph3: React.ReactNode = "";
  if (previousYear) {
    paragraph3 = `Em ${currentYear}, foram encontradas ${newSpeciesCount} espécies novas em comparação com os anos anteriores.`;
  } else {
    paragraph3 = `Em ${currentYear}, foram encontradas ${newSpeciesCount} espécies novas.`;
  }

  // Paragraph 4: Average abundancy
  let paragraph4: React.ReactNode = "";
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

    paragraph4 = (
      <>
        A abundância média foi de{" "}
        <Text strong>
          {currentAvgAbundancy.toFixed(1)} indivíduos por {visitSingular}
        </Text>{" "}
        (ano anterior: {previousAvgAbundancy.toFixed(1)}, {changeDirection} de{" "}
        {Math.abs(parseFloat(percentChange))}% {changeIcon}).
      </>
    );
  } else {
    paragraph4 = `A abundância média foi de ${currentAvgAbundancy.toFixed(1)} indivíduos por ${visitSingular}.`;
  }

  // Paragraph 5: Most frequent species
  let paragraph5: React.ReactNode = "";
  if (currentMostFrequent) {
    if (previousMostFrequent) {
      paragraph5 = (
        <>
          A espécie mais frequente foi <Text italic>{currentMostFrequent.species}</Text> (
          {currentMostFrequent.frequency.toFixed(0)}%), no ano anterior foi{" "}
          <Text italic>{previousMostFrequent.species}</Text> (
          {previousMostFrequent.frequency.toFixed(0)}%).
        </>
      );
    } else {
      paragraph5 = (
        <>
          A espécie mais frequente foi <Text italic>{currentMostFrequent.species}</Text> (
          {currentMostFrequent.frequency.toFixed(0)}%).
        </>
      );
    }
  }

  // Paragraph 6: Most abundant species
  let paragraph6: React.ReactNode = "";
  if (currentMostAbundant) {
    if (previousMostAbundant) {
      paragraph6 = (
        <>
          A espécie mais abundante foi <Text italic>{currentMostAbundant.species}</Text> (
          {currentMostAbundant.abundance} indivíduos), no ano anterior foi{" "}
          <Text italic>{previousMostAbundant.species}</Text> ({previousMostAbundant.abundance}{" "}
          indivíduos).
        </>
      );
    } else {
      paragraph6 = (
        <>
          A espécie mais abundante foi <Text italic>{currentMostAbundant.species}</Text> (
          {currentMostAbundant.abundance} indivíduos).
        </>
      );
    }
  }

  // Paragraph 7: Best months
  let paragraph7 = "";
  if (currentBestMonthFreq && currentBestMonthAbund) {
    if (previousBestMonthFreq && previousBestMonthAbund) {
      paragraph7 = `O melhor mês para diversidade foi ${currentBestMonthFreq.month} (${currentBestMonthFreq.speciesCount} espécies) e para abundância foi ${currentBestMonthAbund.month} (${currentBestMonthAbund.abundance.toFixed(1)} indivíduos/${visitSingular}). No ano anterior: ${previousBestMonthFreq.month} (${previousBestMonthFreq.speciesCount} espécies) e ${previousBestMonthAbund.month} (${previousBestMonthAbund.abundance.toFixed(1)} indivíduos/${visitSingular}), respectivamente.`;
    } else {
      paragraph7 = `O melhor mês para diversidade foi ${currentBestMonthFreq.month} (${currentBestMonthFreq.speciesCount} espécies) e para abundância foi ${currentBestMonthAbund.month} (${currentBestMonthAbund.abundance.toFixed(1)} indivíduos/${visitSingular}).`;
    }
  }

  return (
    <Card title="Sumário" size="small">
      <div data-chart-export data-export-as-text data-chart-export-title="Sumário">
        <Paragraph className="paragraph">{paragraph1}</Paragraph>
        {paragraph2 && <Paragraph className="paragraph">{paragraph2}</Paragraph>}
        <Paragraph className="paragraph">{paragraph3}</Paragraph>
        {paragraph4 && <Paragraph className="paragraph">{paragraph4}</Paragraph>}
        {paragraph5 && <Paragraph className="paragraph">{paragraph5}</Paragraph>}
        {paragraph6 && <Paragraph className="paragraph">{paragraph6}</Paragraph>}
        {paragraph7 && <Paragraph className="paragraph">{paragraph7}</Paragraph>}
      </div>
    </Card>
  );
}

export default TransectSummary;
