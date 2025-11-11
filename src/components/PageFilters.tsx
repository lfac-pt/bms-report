import { Select } from "antd";

interface PageFiltersProps {
    yearsList: number[];
    selectedYears: number[];
    transectsList: string[];
    targetTransect: string | null;
    onSelectedYearsChange: (years: number[]) => void;
    onTargetTransectChange: (transect: string) => void;
    sectionsList: string[];
    targetSection: string | null;
    onTargetSectionChange: (section: string | null) => void;
}

function PageFilters({
    yearsList,
    selectedYears,
    transectsList,
    targetTransect,
    onSelectedYearsChange,
    onTargetTransectChange,
    sectionsList,
    targetSection,
    onTargetSectionChange
}: PageFiltersProps) {
    const yearOptions = yearsList.map((year) => {
        return ({
            value: year,
            label: <span>{year}</span>
        });
    });

    const transectOptions = transectsList.map((transect) => {
        return ({
            value: transect,
            label: <span>{transect}</span>
        });
    });

    const sectionOptions = sectionsList.map((section) => {
        return ({
            value: section,
            label: <span>{section}</span>
        });
    });

    return (
        <>
            <Select
                mode="multiple"
                options={yearOptions}
                value={selectedYears}
                onChange={onSelectedYearsChange}
                style={{ minWidth: 200 }}
                placeholder="Selecione anos"
            />
            <Select
                options={transectOptions}
                value={targetTransect}
                onChange={onTargetTransectChange}
                style={{ /*width: '100%'*/ }}
            />
            <Select
                options={sectionOptions}
                value={targetSection}
                onChange={onTargetSectionChange}
                style={{ /*width: '100%'*/ }}
                allowClear
                placeholder="Todas as secções"
                optionFilterProp="value"
                filterSort={(optionA, optionB) =>
                    (optionA.value ?? '').toLowerCase().localeCompare((optionB?.value ?? '').toLowerCase())
                }
            />
        </>
    );
}

export default PageFilters;
