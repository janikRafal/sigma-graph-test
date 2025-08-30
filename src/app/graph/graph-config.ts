export const GRAPH_CONFIG = {
  // Konfiguracja renderera Sigma
  renderer: {
    renderLabels: true,
    renderEdgeLabels: true,
    defaultNodeColor: '#999',
    defaultEdgeColor: '#ccc',
    labelDensity: 0.07,
    labelGridCellSize: 60,
    labelRenderedSizeThreshold: 15,
    zIndex: true,
  },

  // Konfiguracja layoutu ForceAtlas2
  layout: {
    iterations: 300,
    settings: {
      gravity: 0.1,
      scalingRatio: 1000,
      strongGravityMode: false,
      slowDown: 5,
      adjustSizes: true,
      barnesHutOptimize: true,
      barnesHutTheta: 0.5,
      linLogMode: false,
      outboundAttractionDistribution: false,
    },
  },

  // Domyślne właściwości węzłów i krawędzi
  defaults: {
    node: {
      size: 20,
      highlighted: false,
    },
    edge: {
      color: '#cccccc',
      size: 2,
      animated: true,
    },
  },

  // Konfiguracja animacji i efektów
  animations: {
    resetPosition: {
      duration: 500,
      margin: 0.15,
    },
    clickEffect: {
      duration: 200,
      sizeMultiplier: 1.5,
    },
    hover: {
      centerNodeSize: 30,
      neighborNodeSize: 25,
      dimmedNodeSize: 15,
      highlightedEdgeSize: 4,
      dimmedEdgeSize: 1,
      pulseSpeed: 0.1,
    },
  },

  // Kolory efektów
  colors: {
    highlighted: '#ff6b6b',
    dimmed: '#cccccc',
    dimmedEdge: '#e0e0e0',
  },
};
