import React, { useRef, useState } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import Highlighter from 'react-highlight-words';
import { Card, Table, Alert, Button, Input, Space } from "antd";

function getVisitsCount(dataset) {
    const dates = new Set();
  
    for (const entry of dataset) {
      dates.add(entry.Date); 
    }

    return dates.size;
}

// Deduplicate
function getAllSpecies(dataset) {
    const speciesSet = new Set();
  
    for (const entry of dataset) {
      const species = entry['Preferred Species Name'];
  
      if (species.split(" ").length === 2) {
        speciesSet.add(species);
      }
    }
  
    return [...speciesSet];
}

function calculateRows(dataset) {
    const totalVisits = getVisitsCount(dataset);
    const allSpecies = getAllSpecies(dataset);
    const frequencyMap = {};
    const abundancyMap = {};

    for (const entry of dataset) {
        const species = entry['Preferred Species Name'];

        if (!frequencyMap[species]) {
            frequencyMap[species] = new Set();
        }

        frequencyMap[species].add(entry.Date);
    
        if (!abundancyMap[species]) {
            abundancyMap[species] = 0;
        }

        abundancyMap[species] += entry["Abundance count"];
    }

    return allSpecies.map((species) => {
        return {
            key: species,
            species: species,
            frequencyAbs: frequencyMap[species].size, 
            frequency: ((frequencyMap[species].size / totalVisits) * 100).toFixed(0) + "%",
            abundancy: abundancyMap[species] ? abundancyMap[species] : 0,
        };
    });
}

function AbsoluteFrequencyAndAbundancy({ dataset }) {
  const anundanciaPorMesTitle = "Frequência e abundância";
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef(null);

  const handleSearch = (
    selectedKeys,
    confirm,
    dataIndex,
  ) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters) => {
    clearFilters();
    setSearchText('');
  };

  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
          >
            Reset
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              confirm({ closeDropdown: false });
              setSearchText((selectedKeys)[0]);
              setSearchedColumn(dataIndex);
            }}
          >
            Filter
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              close();
            }}
          >
            close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
    ),
    onFilter: (value, record) =>
      record[dataIndex]
        .toString()
        .toLowerCase()
        .includes((value).toLowerCase()),
    onFilterDropdownOpenChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100);
      }
    },
    render: (text) =>
      searchedColumn === dataIndex ? (
        <Highlighter
          highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ''}
        />
      ) : (
        text
      ),
  });
  
  const columns = [
    {
      title: 'Espécie',
      dataIndex: 'species',
      key: 'species',
      ...getColumnSearchProps('species'),
    },
    {
      title: 'Frequência',
      dataIndex: 'frequency',
      key: 'frequency',
      sorter: (a, b) => a.frequencyAbs - b.frequencyAbs,
    },
    {
      title: 'Abundância',
      dataIndex: 'abundancy',
      key: 'abundancy',
      sorter: (a, b) => a.abundancy - b.abundancy,
    },
  ];
  
  return (
    <Card title={anundanciaPorMesTitle} size="small">
        <Table dataSource={calculateRows(dataset)} columns={columns} pagination={{showSizeChanger: true}} />
        <Alert message="Frenquência é a percentagem de visitas em que foi avistada. Abundância é o total de indivíduos contados." type="info" />
    </Card>
  );
}

export default AbsoluteFrequencyAndAbundancy;
