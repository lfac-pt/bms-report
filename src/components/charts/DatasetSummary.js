import { Card, Row, Col } from "antd";


function getDiversityTotal(dataset) {
    let species = new Set();
  
    for (const entry of dataset) {
      species.add(entry['Preferred Species Name']); 
    }
  
    for (const sp of species) {
        const isSingleWord = sp.split(" ").length === 1;
        const isFamily = sp.endsWith("ae");
        const hasSpeciesInSet = species.values().find((setSp) => {
          return setSp.split(" ").length === 2 && setSp.includes(sp);
        });
        const shouldBeCounted = !isSingleWord || (isSingleWord && !isFamily && !hasSpeciesInSet);
  
        if (!shouldBeCounted) {
            species.delete(sp);
        }
    }
  
    return species.size;
}

function getVisitsCount(dataset) {
    const dates = new Set();
  
    for (const entry of dataset) {
      dates.add(entry.Date); 
    }

    return dates.size;
}

function getIndividualsCount(dataset) {
    let total = 0;
  
    for (const entry of dataset) {
      total += entry["Abundance count"];
    }

    return total;
}

function calculateMetrics(dataset) {
    return {
        "visits_count": getVisitsCount(dataset),
        "species_count": getDiversityTotal(dataset),
        "total_indivuals_count": getIndividualsCount(dataset),
    };
}

function DatasetSummary({ dataset }) {
  const anundanciaPorMesTitle = "Sumário";

  const metrics = calculateMetrics(dataset);

  return (
    <Card title={anundanciaPorMesTitle} size="small">
          <Row gutter={16}>
            <Col span={8}>
                <Card title="Total de espécies" bordered={false}>
                    {metrics.species_count}
                </Card>
            </Col>
            <Col span={8}>
                <Card title="Número de Visitas" bordered={false}>
                    {metrics.visits_count}
                </Card>
            </Col>
            <Col span={8}>
                <Card title="Total de indivíduos" bordered={false}>
                    {metrics.total_indivuals_count}
                </Card>
            </Col>
        </Row>
    </Card>
  );
}

export default DatasetSummary;
