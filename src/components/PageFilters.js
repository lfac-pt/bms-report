import { Select } from "antd";
  
  
function PageFilters({ yearsList, targetYear, transectsList, targetTransect, onTargetYearChange, onTargetTransectChange }) {
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
        </>
    );
}
  
export default PageFilters;
  