import { picture1 } from './graph-pictures';

export interface DatasetNode {
  id: string;
  label: string;
  color: string;
  image?: string;
}

export interface DatasetEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Dataset {
  name: string;
  nodes: DatasetNode[];
  edges: DatasetEdge[];
}

export const GRAPH_DATASETS: Dataset[] = [
  {
    name: 'Social Network',
    nodes: [
      { id: 'alice', label: 'Alice', color: '#ff6b6b', image: picture1 },
      { id: 'bob', label: 'Bob', color: '#4ecdc4' },
      { id: 'charlie', label: 'Charlie', color: '#45b7d1' },
      { id: 'diana', label: 'Diana', color: '#96ceb4', image: picture1 },
      { id: 'eve', label: 'Eve', color: '#feca57', image: picture1 },
      { id: 'frank', label: 'Frank', color: '#ff9ff3' },
    ],
    edges: [
      { from: 'alice', to: 'bob', label: 'friends' },
      { from: 'bob', to: 'charlie', label: 'colleagues' },
      { from: 'charlie', to: 'diana', label: 'siblings' },
      { from: 'diana', to: 'alice', label: 'roommates' },
      { from: 'alice', to: 'eve', label: 'neighbors' },
      { from: 'eve', to: 'frank', label: 'married' },
      { from: 'frank', to: 'charlie', label: 'cousins' },
    ],
  },
  {
    name: 'Development Team',
    nodes: [
      { id: 'frontend', label: 'Sarah', color: '#e74c3c', image: picture1 },
      { id: 'backend', label: 'Michael', color: '#3498db' },
      { id: 'database', label: 'Jessica', color: '#2ecc71', image: picture1 },
      { id: 'cache', label: 'David', color: '#f39c12' },
      { id: 'cdn', label: 'Emma', color: '#9b59b6', image: picture1 },
      { id: 'api', label: 'Alex', color: '#1abc9c' },
      { id: 'auth', label: 'Ryan', color: '#e67e22' },
    ],
    edges: [
      { from: 'frontend', to: 'api', label: 'collaborates' },
      { from: 'api', to: 'backend', label: 'partners' },
      { from: 'backend', to: 'database', label: 'works with' },
      { from: 'backend', to: 'cache', label: 'mentors' },
      { from: 'frontend', to: 'cdn', label: 'friends' },
      { from: 'api', to: 'auth', label: 'teammates' },
      { from: 'auth', to: 'database', label: 'colleagues' },
    ],
  },
  {
    name: 'Company Leadership',
    nodes: [
      { id: 'ceo', label: 'Robert', color: '#8e44ad' },
      { id: 'cto', label: 'Linda', color: '#2980b9', image: picture1 },
      { id: 'cmo', label: 'James', color: '#27ae60' },
      { id: 'dev1', label: 'Sophie', color: '#f39c12', image: picture1 },
      { id: 'dev2', label: 'Marcus', color: '#e74c3c' },
      {
        id: 'marketing',
        label: 'Anna',
        color: '#16a085',
        image: picture1,
      },
      { id: 'sales', label: 'Thomas', color: '#d35400' },
      { id: 'support', label: 'Maria', color: '#7f8c8d', image: picture1 },
    ],
    edges: [
      { from: 'ceo', to: 'cto', label: 'supervises' },
      { from: 'ceo', to: 'cmo', label: 'supervises' },
      { from: 'cto', to: 'dev1', label: 'mentors' },
      { from: 'cto', to: 'dev2', label: 'mentors' },
      { from: 'cmo', to: 'marketing', label: 'guides' },
      { from: 'cmo', to: 'sales', label: 'guides' },
      { from: 'ceo', to: 'support', label: 'oversees' },
      { from: 'dev1', to: 'dev2', label: 'collaborates' },
    ],
  },
];
