import { picture1 } from './graph-pictures';

export interface MultiValue<T = string> {
  values: {
    system: string;
    insertionAt: string;
    value: T;
  }[];
}

export type NodeLabel = 'EVENT' | 'VEHICLE' | 'ADDRESS' | 'GROUP';

export interface NodeProperties {
  is_deleted: false;
  [key: string]: string | number | boolean | MultiValue | undefined;
}

export interface DatasetNode {
  id: string;
  label: NodeLabel;
  properties: NodeProperties;
  relationsCount?: number;
}

export interface EdgeProperties {
  createdAt: string;
  is_deleted: false;
  RELATION_ID: string;
  [key: string]: string | boolean | undefined;
}

export interface DatasetEdge {
  id: string;
  startNodeID: string;
  endNodeID: string;
  properties: EdgeProperties;
}

export interface Dataset {
  name: string;
  nodes: DatasetNode[];
  relations: DatasetEdge[];
}

const SYNTHETIC_NODE_TARGET = 50;

const mv = <T>(
  value: T,
  system = 'GEN',
  insertionAt = new Date().toISOString()
): MultiValue<T> => ({
  values: [{ system, insertionAt, value }],
});

const femaleNames = [
  'Agnieszka',
  'Katarzyna',
  'Anna',
  'Maria',
  'Magdalena',
  'Zofia',
  'Julia',
  'Maja',
  'Oliwia',
  'Aleksandra',
  'Natalia',
  'Karolina',
  'Weronika',
  'Ewa',
  'Joanna',
  'Paulina',
];

const maleNames = [
  'Jan',
  'Piotr',
  'Krzysztof',
  'Andrzej',
  'Tomasz',
  'Paweł',
  'Michał',
  'Marcin',
  'Jakub',
  'Mateusz',
  'Adam',
  'Rafał',
  'Kamil',
  'Łukasz',
  'Dawid',
  'Szymon',
];

const relationLabels: Record<string, string> = {
  residential_address: 'adres zamieszkania',
  vehicle: 'pojazd',
  crossing_the_border: 'przekroczenie granicy',
  submitting_visa_application: 'złożenie wniosku wizowego',
};

const cities: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Warszawa', lat: 52.2297, lon: 21.0122 },
  { name: 'Kraków', lat: 50.0647, lon: 19.945 },
  { name: 'Gdańsk', lat: 54.352, lon: 18.6466 },
  { name: 'Wrocław', lat: 51.1079, lon: 17.0385 },
  { name: 'Poznań', lat: 52.4064, lon: 16.9252 },
  { name: 'Łódź', lat: 51.7592, lon: 19.455 },
  { name: 'Szczecin', lat: 53.4285, lon: 14.5528 },
  { name: 'Lublin', lat: 51.2465, lon: 22.5684 },
  { name: 'Katowice', lat: 50.2649, lon: 19.0238 },
  { name: 'Białystok', lat: 53.1325, lon: 23.1688 },
];

const carBrands = [
  'Audi',
  'BMW',
  'Mercedes',
  'Skoda',
  'Toyota',
  'Volkswagen',
  'Volvo',
  'Ford',
];

const createdAtISO = '2025-08-27T00:00:00.000Z';

function generateSyntheticDataset(totalNodes: number): Dataset {
  const personsCount = Math.max(10, Math.floor(totalNodes * 0.5));
  const addressesCount = Math.max(5, Math.floor(totalNodes * 0.2));
  const vehiclesCount = Math.max(5, Math.floor(totalNodes * 0.2));
  const eventsCount = Math.max(
    2,
    totalNodes - personsCount - addressesCount - vehiclesCount
  );

  const nodes: DatasetNode[] = [];
  const relations: DatasetEdge[] = [];

  let edgeSeq = 1;

  for (let i = 0; i < personsCount; i++) {
    const isFemale = i % 2 === 0;
    const name = isFemale
      ? femaleNames[i % femaleNames.length]
      : maleNames[i % maleNames.length];
    const id = `p_${(i + 1).toString().padStart(3, '0')}`;

    nodes.push({
      id,
      label: 'GROUP',
      properties: {
        is_deleted: false,
        NODE_ID: id,
        displayName: mv(name),
        gender: mv(isFemale ? 'female' : 'male'),
        ...(isFemale ? { image: picture1 } : {}),
      },
    });
  }

  for (let i = 0; i < addressesCount; i++) {
    const city = cities[i % cities.length];
    const id = `a_${(i + 1).toString().padStart(3, '0')}`;

    nodes.push({
      id,
      label: 'ADDRESS',
      properties: {
        is_deleted: false,
        NODE_ID: id,
        displayName: mv(`${city.name} (PL)`),
        country: mv('Polska'),
        lat: mv(String(city.lat)),
        lon: mv(String(city.lon)),
      },
    });
  }

  for (let i = 0; i < vehiclesCount; i++) {
    const brand = carBrands[i % carBrands.length];
    const plate = `P${(i + 1).toString().padStart(3, '0')}-XYZ`;
    const id = `v_${(i + 1).toString().padStart(3, '0')}`;

    nodes.push({
      id,
      label: 'VEHICLE',
      properties: {
        is_deleted: false,
        NODE_ID: id,
        displayName: mv(plate),
        brand: mv(brand),
      },
    });
  }

  for (let i = 0; i < eventsCount; i++) {
    const id = `e_${(i + 1).toString().padStart(3, '0')}`;
    nodes.push({
      id,
      label: 'EVENT',
      properties: {
        is_deleted: false,
        NODE_ID: id,
        displayName: mv(`Wydarzenie ${i + 1}`),
        date: mv(createdAtISO),
      },
    });
  }

  const personIds = nodes.filter((n) => n.label === 'GROUP').map((n) => n.id);
  const addressIds = nodes
    .filter((n) => n.label === 'ADDRESS')
    .map((n) => n.id);
  const vehicleIds = nodes
    .filter((n) => n.label === 'VEHICLE')
    .map((n) => n.id);
  const eventIds = nodes.filter((n) => n.label === 'EVENT').map((n) => n.id);

  for (let i = 0; i < personIds.length; i++) {
    const personId = personIds[i];

    if (addressIds.length) {
      const addrId = addressIds[i % addressIds.length];
      relations.push({
        id: `rel_syn_${edgeSeq++}`,
        startNodeID: personId,
        endNodeID: addrId,
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'residential_address',
          label: relationLabels['residential_address'],
        },
      });
    }

    if (vehicleIds.length) {
      const vehId = vehicleIds[i % vehicleIds.length];
      relations.push({
        id: `rel_syn_${edgeSeq++}`,
        startNodeID: personId,
        endNodeID: vehId,
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'vehicle',
          label: relationLabels['vehicle'],
        },
      });
    }

    if (eventIds.length) {
      const evId = eventIds[i % eventIds.length];
      relations.push({
        id: `rel_syn_${edgeSeq++}`,
        startNodeID: personId,
        endNodeID: evId,
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'crossing_the_border',
          label: relationLabels['crossing_the_border'],
        },
      });
    }
  }

  for (let j = 0; j < eventIds.length; j++) {
    if (!addressIds.length) break;
    relations.push({
      id: `rel_syn_${edgeSeq++}`,
      startNodeID: eventIds[j],
      endNodeID: addressIds[j % addressIds.length],
      properties: {
        createdAt: createdAtISO,
        is_deleted: false,
        RELATION_ID: 'submitting_visa_application',
        label: relationLabels['submitting_visa_application'],
      },
    });
  }

  return {
    name: `Synthetic (${nodes.length} nodes)`,
    nodes,
    relations,
  };
}

// ---------- Datasety ----------

export const GRAPH_DATASETS: Dataset[] = [
  generateSyntheticDataset(SYNTHETIC_NODE_TARGET),

  {
    name: 'Social Network',
    nodes: [
      {
        id: 'alice',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'alice',
          displayName: {
            values: [
              {
                system: 'APP',
                insertionAt: '2025-08-27T00:00:00.000Z',
                value: 'Alice',
              },
            ],
          },
          image: picture1,
        },
      },
      {
        id: 'bob',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'bob',
          displayName: {
            values: [
              {
                system: 'APP',
                insertionAt: '2025-08-27T00:00:00.000Z',
                value: 'Bob',
              },
            ],
          },
        },
      },
      {
        id: 'charlie',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'charlie',
          displayName: {
            values: [
              {
                system: 'APP',
                insertionAt: '2025-08-27T00:00:00.000Z',
                value: 'Charlie',
              },
            ],
          },
        },
      },
      {
        id: 'diana',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'diana',
          displayName: {
            values: [
              {
                system: 'APP',
                insertionAt: '2025-08-27T00:00:00.000Z',
                value: 'Diana',
              },
            ],
          },
          image: picture1,
        },
      },
      {
        id: 'eve',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'eve',
          displayName: {
            values: [
              {
                system: 'APP',
                insertionAt: '2025-08-27T00:00:00.000Z',
                value: 'Eve',
              },
            ],
          },
          image: picture1,
        },
      },
      {
        id: 'frank',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'frank',
          displayName: {
            values: [
              {
                system: 'APP',
                insertionAt: '2025-08-27T00:00:00.000Z',
                value: 'Frank',
              },
            ],
          },
        },
      },
    ],
    relations: [
      {
        id: 'rel_sn_1',
        startNodeID: 'alice',
        endNodeID: 'bob',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'friends',
          label: 'friends',
        },
      },
      {
        id: 'rel_sn_2',
        startNodeID: 'bob',
        endNodeID: 'charlie',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'colleagues',
          label: 'colleagues',
        },
      },
      {
        id: 'rel_sn_3',
        startNodeID: 'charlie',
        endNodeID: 'diana',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'siblings',
          label: 'siblings',
        },
      },
      {
        id: 'rel_sn_4',
        startNodeID: 'diana',
        endNodeID: 'alice',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'roommates',
          label: 'roommates',
        },
      },
      {
        id: 'rel_sn_5',
        startNodeID: 'alice',
        endNodeID: 'eve',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'neighbors',
          label: 'neighbors',
        },
      },
      {
        id: 'rel_sn_6',
        startNodeID: 'eve',
        endNodeID: 'frank',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'married',
          label: 'married',
        },
      },
      {
        id: 'rel_sn_7',
        startNodeID: 'frank',
        endNodeID: 'charlie',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'cousins',
          label: 'cousins',
        },
      },
    ],
  },

  {
    name: 'Development Team',
    nodes: [
      {
        id: 'frontend',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'frontend',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Sarah' },
            ],
          },
          image: picture1,
        },
      },
      {
        id: 'backend',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'backend',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Michael' },
            ],
          },
        },
      },
      {
        id: 'database',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'database',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Jessica' },
            ],
          },
          image: picture1,
        },
      },
      {
        id: 'cache',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'cache',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'David' },
            ],
          },
        },
      },
      {
        id: 'cdn',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'cdn',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Emma' },
            ],
          },
          image: picture1,
        },
      },
      {
        id: 'api',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'api',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Alex' },
            ],
          },
        },
      },
      {
        id: 'auth',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'auth',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Ryan' },
            ],
          },
        },
      },
    ],
    relations: [
      {
        id: 'rel_dt_1',
        startNodeID: 'frontend',
        endNodeID: 'api',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'collaborates',
          label: 'collaborates',
        },
      },
      {
        id: 'rel_dt_2',
        startNodeID: 'api',
        endNodeID: 'backend',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'partners',
          label: 'partners',
        },
      },
      {
        id: 'rel_dt_3',
        startNodeID: 'backend',
        endNodeID: 'database',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'works with',
          label: 'works with',
        },
      },
      {
        id: 'rel_dt_4',
        startNodeID: 'backend',
        endNodeID: 'cache',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'mentors',
          label: 'mentors',
        },
      },
      {
        id: 'rel_dt_5',
        startNodeID: 'frontend',
        endNodeID: 'cdn',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'friends',
          label: 'friends',
        },
      },
      {
        id: 'rel_dt_6',
        startNodeID: 'api',
        endNodeID: 'auth',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'teammates',
          label: 'teammates',
        },
      },
      {
        id: 'rel_dt_7',
        startNodeID: 'auth',
        endNodeID: 'database',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'colleagues',
          label: 'colleagues',
        },
      },
    ],
  },

  {
    name: 'Company Leadership',
    nodes: [
      {
        id: 'ceo',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'ceo',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Robert' },
            ],
          },
        },
      },
      {
        id: 'cto',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'cto',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Linda' },
            ],
          },
          image: picture1,
        },
      },
      {
        id: 'cmo',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'cmo',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'James' },
            ],
          },
        },
      },
      {
        id: 'dev1',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'dev1',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Sophie' },
            ],
          },
          image: picture1,
        },
      },
      {
        id: 'dev2',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'dev2',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Marcus' },
            ],
          },
        },
      },
      {
        id: 'marketing',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'marketing',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Anna' },
            ],
          },
          image: picture1,
        },
      },
      {
        id: 'sales',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'sales',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Thomas' },
            ],
          },
        },
      },
      {
        id: 'support',
        label: 'GROUP',
        properties: {
          is_deleted: false,
          NODE_ID: 'support',
          displayName: {
            values: [
              { system: 'APP', insertionAt: createdAtISO, value: 'Maria' },
            ],
          },
          image: picture1,
        },
      },
    ],
    relations: [
      {
        id: 'rel_cl_1',
        startNodeID: 'ceo',
        endNodeID: 'cto',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'supervises',
          label: 'supervises',
        },
      },
      {
        id: 'rel_cl_2',
        startNodeID: 'ceo',
        endNodeID: 'cmo',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'supervises',
          label: 'supervises',
        },
      },
      {
        id: 'rel_cl_3',
        startNodeID: 'cto',
        endNodeID: 'dev1',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'mentors',
          label: 'mentors',
        },
      },
      {
        id: 'rel_cl_4',
        startNodeID: 'cto',
        endNodeID: 'dev2',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'mentors',
          label: 'mentors',
        },
      },
      {
        id: 'rel_cl_5',
        startNodeID: 'cmo',
        endNodeID: 'marketing',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'guides',
          label: 'guides',
        },
      },
      {
        id: 'rel_cl_6',
        startNodeID: 'cmo',
        endNodeID: 'sales',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'guides',
          label: 'guides',
        },
      },
      {
        id: 'rel_cl_7',
        startNodeID: 'ceo',
        endNodeID: 'support',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'oversees',
          label: 'oversees',
        },
      },
      {
        id: 'rel_cl_8',
        startNodeID: 'dev1',
        endNodeID: 'dev2',
        properties: {
          createdAt: createdAtISO,
          is_deleted: false,
          RELATION_ID: 'collaborates',
          label: 'collaborates',
        },
      },
    ],
  },
];
