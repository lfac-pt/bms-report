import React, { useRef, useState } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import Highlighter from 'react-highlight-words';
import { Card, Table, Alert, Button, Input, Space } from "antd";
import { Dataset } from "../../types/dataset";

function getVisitsCountByYear(dataset: Dataset, year: number): number {
	const dates = new Set<string>();

	for (const entry of dataset) {
		const entryYear = new Date(entry.Date).getFullYear();
		if (entryYear === year) {
			dates.add(entry.Date);
		}
	}

	return dates.size;
}

// Deduplicate
function getAllSpecies(dataset: Dataset): string[] {
	const speciesSet = new Set<string>();

	for (const entry of dataset) {
		const species = entry['Preferred Species Name'];

		if (species.split(" ").length === 2) {
			speciesSet.add(species);
		}
	}

	return [...speciesSet];
}

interface YearData {
	display: string;
	frequencyAbs: number;
	abundancy: number;
}

interface DataRow {
	key: string;
	species: string;
	[year: number]: YearData;
}

function calculateRows(dataset: Dataset, yearsList: number[]): DataRow[] {
	const allSpecies = getAllSpecies(dataset);
	const dataByYear: Record<number, {
		totalVisits: number;
		frequencyMap: Record<string, Set<string>>;
		abundancyMap: Record<string, number>;
	}> = {};

	// Initialize data structure for each year
	yearsList.forEach(year => {
		dataByYear[year] = {
			totalVisits: getVisitsCountByYear(dataset, year),
			frequencyMap: {},
			abundancyMap: {}
		};
	});

	// Process dataset entries
	for (const entry of dataset) {
		const species = entry['Preferred Species Name'];
		const entryYear = new Date(entry.Date).getFullYear();

		if (dataByYear[entryYear]) {
			// Track frequency (unique dates per species per year)
			if (!dataByYear[entryYear].frequencyMap[species]) {
				dataByYear[entryYear].frequencyMap[species] = new Set();
			}
			dataByYear[entryYear].frequencyMap[species].add(entry.Date);

			// Track abundancy (total count per species per year)
			if (!dataByYear[entryYear].abundancyMap[species]) {
				dataByYear[entryYear].abundancyMap[species] = 0;
			}
			dataByYear[entryYear].abundancyMap[species] += entry["Abundance count"];
		}
	}

	// Build rows with data for each species across all years
	return allSpecies.map((species) => {
		const row: any = {
			key: species,
			species: species,
		};

		// Add data for each year
		yearsList.forEach(year => {
			const yearData = dataByYear[year];
			const frequencySet = yearData.frequencyMap[species];
			const abundancy = yearData.abundancyMap[species] || 0;
			const frequencyAbs = frequencySet ? frequencySet.size : 0;
			const frequencyPercent = yearData.totalVisits > 0
				? ((frequencyAbs / yearData.totalVisits) * 100).toFixed(0)
				: 0;

			row[year] = {
				display: `${frequencyPercent}% / ${abundancy}`,
				frequencyAbs: frequencyAbs,
				abundancy: abundancy
			};
		});

		return row;
	});
}

interface AbsoluteFrequencyAndAbundancyProps {
	dataset: Dataset;
	yearsList: number[];
	targetTransect: string | null;
	targetSection: string | null;
}

function AbsoluteFrequencyAndAbundancy({ dataset, yearsList, targetTransect, targetSection }: AbsoluteFrequencyAndAbundancyProps) {
	// Filter dataset by transect and section
	const filteredDataset = dataset.filter(entry => {
		const matchesTransect = !targetTransect || entry["Transect ID"] === targetTransect;
		const matchesSection = !targetSection || entry["Section Name"] === targetSection;
		return matchesTransect && matchesSection;
	});
	const anundanciaPorMesTitle = `Frequência e abundância`;
	const [searchText, setSearchText] = useState<string>('');
	const [searchedColumn, setSearchedColumn] = useState<string>('');
	const searchInput = useRef<any>(null);

	const handleSearch = (
		selectedKeys: React.Key[],
		confirm: () => void,
		dataIndex: string,
	) => {
		confirm();
		setSearchText(selectedKeys[0] as string);
		setSearchedColumn(dataIndex);
	};

	const handleReset = (clearFilters: () => void) => {
		clearFilters();
		setSearchText('');
	};

	const getColumnSearchProps = (dataIndex: string): any => ({
		filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }: any) => (
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
		filterIcon: (filtered: boolean) => (
			<SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
		),
		onFilter: (value: any, record: any) =>
			record[dataIndex]
				.toString()
				.toLowerCase()
				.includes((value).toLowerCase()),
		onFilterDropdownOpenChange: (visible: boolean) => {
			if (visible) {
				setTimeout(() => searchInput.current?.select(), 100);
			}
		},
		render: (text: any) =>
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

	// Build columns dynamically based on yearsList
	const columns: any[] = [
		{
			title: 'Espécie',
			dataIndex: 'species',
			key: 'species',
			...getColumnSearchProps('species'),
		},
		...yearsList.map(year => ({
			title: year.toString(),
			dataIndex: year.toString(),
			key: year.toString(),
			render: (data: any) => data ? data.display : '0% / 0',
			sorter: (a: any, b: any) => {
				const aData = a[year] || { frequencyAbs: 0, abundancy: 0 };
				const bData = b[year] || { frequencyAbs: 0, abundancy: 0 };
				// Sort by frequency first, then by abundancy
				if (aData.frequencyAbs !== bData.frequencyAbs) {
					return aData.frequencyAbs - bData.frequencyAbs;
				}
				return aData.abundancy - bData.abundancy;
			},
		}))
	];

	return (
		<Card title={anundanciaPorMesTitle} size="small">
			<Table dataSource={calculateRows(filteredDataset, yearsList)} columns={columns} pagination={{ showSizeChanger: true }} />
			<Alert message="Frenquência é a percentagem de visitas em que foi avistada. Abundância é o total de indivíduos contados. Formato: Frequência% / Abundância" type="info" />
		</Card>
	);
}

export default AbsoluteFrequencyAndAbundancy;
