import { Select } from "antd";
  
  
function PageFilters({ 
  yearsList, 
  targetYear, 
  transectsList, 
  targetTransect, 
  onTargetYearChange, 
  onTargetTransectChange,
  sectionsList,
  targetSection,
  onTargetSectionChange
}) {
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
            options={yearOptions} 
            value={targetYear}
            onChange={onTargetYearChange} 
            style={{ /*width: '100%'*/ }}
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
  