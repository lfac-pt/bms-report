import { useState } from 'react';
import moment from 'moment';
import { Space, theme } from "antd";
import DatasetSummary from "./charts/DatasetSummary";
import AbundancyPerMonth from "./charts/AbundancyPerMonth";
import DiversityPerMonth from "./charts/DiversityPerMonth";
import AbsoluteFrequencyAndAbundancy from "./charts/AbsoluteFrequencyAndAbundancy";
import Uploader from './Uploader';
import PageFilters from './PageFilters';

function getAllYears(dataset) {
  const yearsSet = new Set();

  for (const entry of dataset) {
    const date = moment(entry.Date, "DD-MM-YYYY");
    yearsSet.add(date.year());
  }

  return [...yearsSet].filter((year) => {
    return Number(year) === year;
  });
}

function getAllTransects(dataset) {
  const set = new Set();

  for (const entry of dataset) {
    
    set.add(entry["Transect ID"]);
  }

  return [...set].filter((transectId) => {
    return !!transectId;
  });
}

function filterDataset(dataset, targetYear) {
  return dataset.filter((entry) => {
    const date = moment(entry.Date, "DD-MM-YYYY");

    return date.year() === targetYear;
  });
}

function MyApp() {
  const [dataset, setDataset] = useState([]);

  const [yearsList, setYearsList] = useState([]);
  const [targetYear, setTargetYear] = useState(null);

  const [transectsList, setTransectsList] = useState([]);
  const [targetTransect, setTargetTransect] = useState(null);

  const onTargetYearChange = (newTargetYear) => {
    setTargetYear(newTargetYear)
  };

  const onTargetTransectChange = (newTargetTransect) => {
    setTargetTransect(newTargetTransect);
  };

  const onUpload = (results) => {
    const allYears = getAllYears(results.data);
    setYearsList(allYears);
    setTargetYear(allYears[allYears.length - 1]);

    const allTransects = getAllTransects(results.data);
    setTransectsList(allTransects);
    setTargetTransect(allTransects[allTransects.length - 1]);

    setDataset(results.data);
  };

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const filteredDataset = filterDataset(dataset, targetYear);

  return (
    <Space direction="vertical" size="middle" style={{ 
      display: 'flex', 
      background: colorBgContainer, 
      padding: 24,
      borderRadius: borderRadiusLG,
    }}>
        <Uploader onUpload={onUpload} />
        
        {dataset.length > 0 ? (<>
          <PageFilters 
            targetYear={targetYear} 
            yearsList={yearsList} 
            transectsList={transectsList}
            targetTransect={targetTransect}
            onTargetYearChange={onTargetYearChange} 
            onTargetTransectChange={onTargetTransectChange}
          />
          <DatasetSummary dataset={filteredDataset} />
          <AbsoluteFrequencyAndAbundancy dataset={filteredDataset} />
          <AbundancyPerMonth dataset={filteredDataset} />
          <DiversityPerMonth dataset={filteredDataset} />
        </>) : null}
    </Space> 
  );
}

export default MyApp;
