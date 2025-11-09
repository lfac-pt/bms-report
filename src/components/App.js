import { useState } from 'react';
import moment from 'moment';
import { Space, theme } from "antd";
import AbundancyPerMonth from "./charts/AbundancyPerMonth";
import DiversityPerMonth from "./charts/DiversityPerMonth";
import AbsoluteFrequencyAndAbundancy from "./charts/AbsoluteFrequencyAndAbundancy";
import Uploader from './Uploader';
import PageFilters from './PageFilters';
import YearComparison from "./charts/YearComparison";
import { filterDataset } from './utils';

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

function getAllSections(dataset, transect) {
    const set = new Set();

    for (const entry of dataset) {
        if (entry["Transect ID"] === transect) {
            set.add(entry["Section Name"]);
        }
    }

    return [...set].filter((section) => {
        return !!section;
    });
}



function MyApp() {
    const [dataset, setDataset] = useState([]);

    const [yearsList, setYearsList] = useState([]);
    const [targetYear, setTargetYear] = useState(null);

    const [transectsList, setTransectsList] = useState([]);
    const [targetTransect, setTargetTransect] = useState(null);

    const [sectionsList, setSectionsList] = useState([]);
    const [targetSection, setTargetSection] = useState(null);

    const onTargetYearChange = (newTargetYear) => {
        setTargetYear(newTargetYear)
    };

    const onTargetTransectChange = (newTargetTransect) => {
        setTargetTransect(newTargetTransect);

        const allSectionsForTransect = getAllSections(dataset, newTargetTransect);
        setSectionsList(allSectionsForTransect);
        setTargetSection(null);
    };

    const onTargetSectionChange = (newTargetSection) => {
        setTargetSection(newTargetSection ? newTargetSection : null);
    }

    const onUpload = (results) => {
        const allYears = getAllYears(results.data);
        setYearsList(allYears);
        setTargetYear(allYears[0]);

        const allTransects = getAllTransects(results.data);
        setTransectsList(allTransects);
        setTargetTransect(allTransects[allTransects.length - 1]);

        const allSectionsForTransect = getAllSections(results.data, allTransects[allTransects.length - 1]);
        setSectionsList(allSectionsForTransect);
        setTargetSection(null);

        setDataset(results.data);
    };

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    const filteredDataset = filterDataset(dataset, targetYear, targetTransect, targetSection);

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
                    sectionsList={sectionsList}
                    targetSection={targetSection}
                    onTargetSectionChange={onTargetSectionChange}
                />
                <YearComparison yearsList={yearsList} dataset={dataset} transect={targetTransect} section={targetSection} />
                <AbsoluteFrequencyAndAbundancy dataset={filteredDataset} year={targetYear} />
                <AbundancyPerMonth dataset={filteredDataset} year={targetYear} />
                <DiversityPerMonth dataset={filteredDataset} year={targetYear} />
            </>) : null}
        </Space>
    );
}

export default MyApp;
