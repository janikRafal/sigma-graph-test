import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Sigma, { Camera } from 'sigma';
import Graph from 'graphology';
import { Attributes } from 'graphology-types';

import {
  DatasetEdge,
  DatasetNode,
  GRAPH_DATASETS,
  MultiValue,
  NodeLabel,
  NodeProperties,
} from './graph-datasets';
import { GRAPH_CONFIG } from './graph-config';
import { NodeImageProgram } from '@sigma/node-image';
import noverlap from 'graphology-layout-noverlap';
import ELK from 'elkjs/lib/elk.bundled.js';

interface NodeAttributes {
  x: number;
  y: number;
  size: number;
  label: string;
  color: string;
  highlighted: boolean;
  image?: string;
  type?: string;
}

interface EdgeAttributes extends Attributes {
  color?: string;
  size?: number;
  label?: string;
}

interface ContextMenu {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string | null;
}

interface ExpandedNode {
  nodeId: string;
  expandedChildren: string[];
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-graph-viewer',
  templateUrl: './graph-viewer.component.html',
  styleUrl: './graph-viewer.component.scss',
})
export class GraphViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', { static: true })
  container!: ElementRef<HTMLDivElement>;

  private sigma!: Sigma<NodeAttributes, EdgeAttributes>;
  private graph = new Graph<NodeAttributes, EdgeAttributes>();
  private draggedNode: string | null = null;
  private animationId: number | null = null;
  private hoveredNode: string | null = null;

  protected relationDraftSource: string | null = null;
  protected contextMenuEdges: { id: string; text: string }[] = [];
  selectedEdgeId: string | null = null;
  showRelationDeletePanel = false;
  layoutMode: 'hierarchy' | 'columns' = 'hierarchy';

  showRelationCreatePanel = false;
  relationLabelInput = '';

  enhancedHoverEnabled = true;
  currentDatasetIndex = 0;
  datasets = GRAPH_DATASETS;

  contextMenu: ContextMenu = {
    visible: false,
    x: 0,
    y: 0,
    nodeId: null,
  };

  private expandedNodes: Map<string, ExpandedNode> = new Map();
  private collapsedNodes: Set<string> = new Set();
  private nextNodeId = 1000;
  private nodeChildrenCount: Map<string, number> = new Map();

  constructor() {
    this.initializeGraph();
  }

  switchDataset(index: number): void {
    this.currentDatasetIndex = index;

    this.expandedNodes.clear();
    this.collapsedNodes.clear();
    this.nodeChildrenCount.clear();
    this.hideContextMenu();

    this.graph.clear();
    this.initializeGraph();
  }

  onHoverModeChange(): void {
    if (this.sigma) {
      this.resetAllHighlights();
    }
  }

  resetGraphPosition(): void {
    if (!this.sigma) return;

    const camera = this.sigma.getCamera();
    const bounds = this.getBounds();
    if (!bounds) return;

    const { minX, maxX, minY, maxY } = bounds;
    const graphWidth = Math.max(maxX - minX, 1);
    const graphHeight = Math.max(maxY - minY, 1);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const { width, height } = this.sigma.getDimensions();
    const margin = GRAPH_CONFIG.animations?.resetPosition?.margin ?? 0.15;
    const innerWidth = Math.max(width * (1 - margin), 1);
    const innerHeight = Math.max(height * (1 - margin), 1);

    const ratioX = graphWidth / innerWidth;
    const ratioY = graphHeight / innerHeight;
    const targetRatio = Math.max(ratioX, ratioY);

    const nx = (centerX - minX) / graphWidth;
    const ny = (centerY - minY) / graphHeight;

    camera.animate(
      { x: nx, y: ny, ratio: targetRatio },
      { duration: GRAPH_CONFIG.animations?.resetPosition?.duration ?? 500 }
    );
  }

  resetGraphLayout(): void {
    if (this.sigma) {
      this.resetAllHighlights();

      this.expandedNodes.clear();
      this.collapsedNodes.clear();
      this.nodeChildrenCount.clear();
      this.hideContextMenu();

      this.graph.clear();
      this.initializeGraph();
    }
  }

  private getBounds(): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null {
    if (!this.graph || this.graph.order === 0) return null;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    this.graph.forEachNode((node) => {
      const x = this.graph.getNodeAttribute(node, 'x') || 0;
      const y = this.graph.getNodeAttribute(node, 'y') || 0;
      const size = this.graph.getNodeAttribute(node, 'size') || 20;

      minX = Math.min(minX, x - size);
      maxX = Math.max(maxX, x + size);
      minY = Math.min(minY, y - size);
      maxY = Math.max(maxY, y + size);
    });

    return { minX, maxX, minY, maxY };
  }

  private initializeGraph(): void {
    const currentDataset = this.datasets[this.currentDatasetIndex];
    const { nodes, relations } = currentDataset;

    this.addNodesToGraph(nodes);
    this.addEdgesToGraph(relations);
    this.applyLayout();
  }

  private applyLabelColumnsSeedLayout(): void {
    const currentDataset = this.datasets[this.currentDatasetIndex];
    const byId = new Map(currentDataset.nodes.map((n) => [n.id, n]));
    const groups: Record<NodeLabel | 'OTHER', string[]> = {
      EVENT: [],
      GROUP: [],
      VEHICLE: [],
      ADDRESS: [],
      OTHER: [],
    };

    this.graph.nodes().forEach((id) => {
      const n = byId.get(id);
      if (!n) groups.OTHER.push(id);
      else groups[n.label].push(id);
    });

    (Object.keys(groups) as Array<keyof typeof groups>).forEach((k) => {
      groups[k].sort((a, b) => a.localeCompare(b));
    });

    const order: Array<keyof typeof groups> = [
      'EVENT',
      'GROUP',
      'VEHICLE',
      'ADDRESS',
      'OTHER',
    ];
    const nonEmpty = order.filter((k) => groups[k].length > 0);

    const COL_GAP = 260;
    const ROW_GAP = 160;
    const totalCols = nonEmpty.length;
    const xStart = -((totalCols - 1) / 2) * COL_GAP;

    nonEmpty.forEach((k, col) => {
      const ids = groups[k];
      const m = ids.length;
      const yStart = -((m - 1) / 2) * ROW_GAP;
      const x = xStart + col * COL_GAP;
      ids.forEach((id, i) => {
        const y = yStart + i * ROW_GAP;
        this.graph.setNodeAttribute(id, 'x', x);
        this.graph.setNodeAttribute(id, 'y', y);
      });
    });
  }

  private addNodesToGraph(nodes: DatasetNode[], anchorNodeId?: string): void {
    const colorByLabel: Record<NodeLabel, string> = {
      EVENT: '#e67e22',
      VEHICLE: '#27ae60',
      ADDRESS: '#45b7d1',
      GROUP: '#8e44ad',
    };

    const defaultNodeColor =
      (GRAPH_CONFIG.renderer &&
        (GRAPH_CONFIG.renderer as { defaultNodeColor?: string })
          .defaultNodeColor) ??
      '#999';

    const firstMultiValue = <T>(mv?: MultiValue<T>): T | undefined =>
      mv?.values?.[0]?.value;

    const getDisplayName = (properties: NodeProperties): string => {
      const display = properties['displayName'] as
        | MultiValue<string>
        | undefined;
      return (
        firstMultiValue<string>(display) ?? String(properties['NODE_ID'] ?? '')
      );
    };

    const getNodeImage = (properties: NodeProperties): string | undefined => {
      return typeof properties['image'] === 'string'
        ? (properties['image'] as string)
        : undefined;
    };

    const existingOrder = this.graph.order;
    const anchorX =
      anchorNodeId && this.graph.hasNode(anchorNodeId)
        ? (this.graph.getNodeAttribute(anchorNodeId, 'x') as number) || 0
        : undefined;
    const anchorY =
      anchorNodeId && this.graph.hasNode(anchorNodeId)
        ? (this.graph.getNodeAttribute(anchorNodeId, 'y') as number) || 0
        : undefined;

    const positionForIndexInitial = (
      index: number,
      total: number
    ): { x: number; y: number } => {
      const R = 700;
      const angleStep = total > 0 ? (2 * Math.PI) / total : 0;
      const angle = index * angleStep;
      return {
        x: Math.cos(angle) * R,
        y: Math.sin(angle) * R,
      };
    };

    let placed = 0;

    nodes.forEach((node, idx) => {
      const nodeImage = getNodeImage(node.properties);
      const baseColor = colorByLabel[node.label] ?? defaultNodeColor;

      if (this.graph.hasNode(node.id)) {
        const currentLabel = this.graph.getNodeAttribute(node.id, 'label');
        if (!currentLabel || currentLabel === node.id) {
          this.graph.setNodeAttribute(
            node.id,
            'label',
            getDisplayName(node.properties)
          );
        }
        if (nodeImage) {
          this.graph.setNodeAttribute(node.id, 'image', nodeImage);
          this.graph.setNodeAttribute(node.id, 'type', 'image');
        }
        return;
      }

      let x = 0;
      let y = 0;

      if (existingOrder === 0) {
        const p = positionForIndexInitial(idx, nodes.length);
        x = p.x;
        y = p.y;
      } else if (anchorX !== undefined && anchorY !== undefined) {
        const p = this.findSafePositionForChild(
          anchorX,
          anchorY,
          placed,
          nodes.length
        );
        x = p.x;
        y = p.y;
        placed++;
      } else {
        const b = this.getBounds();
        const cx = b ? (b.minX + b.maxX) / 2 : 0;
        const cy = b ? (b.minY + b.maxY) / 2 : 0;
        const jitter = 300;
        x = cx + (Math.random() - 0.5) * jitter;
        y = cy + (Math.random() - 0.5) * jitter;
      }

      this.graph.addNode(node.id, {
        label: getDisplayName(node.properties),
        size: GRAPH_CONFIG.defaults.node.size,
        color: baseColor,
        highlighted: GRAPH_CONFIG.defaults.node.highlighted,
        image: nodeImage,
        type: nodeImage ? 'image' : 'circle',
        x,
        y,
      });
    });
  }

  private addEdgesToGraph(relations: DatasetEdge[]): void {
    relations.forEach((rel) => {
      const rawLabel = rel.properties['label'] as string | undefined;
      const label =
        typeof rawLabel === 'string' ? rawLabel : rel.properties.RELATION_ID;

      if (this.graph.hasEdge(rel.id)) return;

      this.graph.addEdgeWithKey(rel.id, rel.startNodeID, rel.endNodeID, {
        color: GRAPH_CONFIG.defaults.edge.color,
        size: GRAPH_CONFIG.defaults.edge.size,
        animated: GRAPH_CONFIG.defaults.edge.animated,
        label,
      });
    });
  }

  private async applyLayout(): Promise<void> {
    const used = await this.applyElkLayeredLayout();
    if (!used) this.applyLabelColumnsSeedLayout();

    noverlap.assign(this.graph, {
      maxIterations: 400,
      settings: { margin: 6, ratio: 1, speed: 3, gridSize: 20 },
    });

    if (this.sigma) {
      this.sigma.refresh();
      requestAnimationFrame(() => this.resetGraphPosition());
    }
  }

  private async applyElkLayeredLayout(): Promise<boolean> {
    const nodes = this.graph.nodes();
    if (!nodes.length) return false;

    const edges = this.graph.edges().map((e) => {
      const [s, t] = this.graph.extremities(e) as [string, string];
      return { id: e, sources: [s], targets: [t] };
    });

    const elk = new ELK();

    const estimateWidth = (id: string): number => {
      const label = (this.graph.getNodeAttribute(id, 'label') as string) || '';
      const w = 14 * Math.min(label.length, 18) + 40;
      return Math.max(80, Math.min(260, w));
    };

    const children = nodes
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((id) => ({
        id,
        width: estimateWidth(id),
        height: 36,
      }));

    const layoutOptions: Record<string, string> = {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.nodePlacement.strategy': 'SIMPLE',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '60',
      'elk.layered.cycleBreaking.strategy': 'GREEDY',
    };

    const model = {
      id: 'root',
      layoutOptions,
      children,
      edges,
    };

    try {
      const res = await elk.layout(model as any);
      const ch = (res.children || []) as Array<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
      if (!ch.length) return false;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      ch.forEach((c) => {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.width);
        maxY = Math.max(maxY, c.y + c.height);
      });
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      ch.forEach((c) => {
        const cx = c.x + c.width / 2 - centerX;
        const cy = c.y + c.height / 2 - centerY;
        if (this.graph.hasNode(c.id)) {
          this.graph.setNodeAttribute(c.id, 'x', cx);
          this.graph.setNodeAttribute(c.id, 'y', cy);
        }
      });

      return true;
    } catch {
      return false;
    }
  }

  ngAfterViewInit(): void {
    try {
      this.initializeSigma();
      this.setupInteractions();

      this.sigma.refresh();
      requestAnimationFrame(() => {
        if (!this.sigma) return;
        this.sigma.refresh();
        this.resetGraphPosition();
      });
    } catch (error) {
      console.error('Failed to initialize Sigma:', error);
    }
  }

  private initializeSigma(): void {
    this.sigma = new Sigma(this.graph, this.container.nativeElement, {
      autoRescale: false,
      ...GRAPH_CONFIG.renderer,
      minCameraRatio: 0.02,
      maxCameraRatio: 100,
      nodeProgramClasses: {
        image: NodeImageProgram,
      },
    } as any);
  }

  private setupInteractions(): void {
    const renderer = this.sigma;
    const camera = renderer.getCamera();

    this.setupDragAndDrop(renderer, camera);
    this.setupHoverEffects(renderer);
    this.setupClickEvents(renderer);
  }

  private setupDragAndDrop(
    renderer: Sigma<NodeAttributes, EdgeAttributes>,
    camera: Camera
  ): void {
    renderer.on('downNode', ({ node, event }) => {
      if (event.original instanceof MouseEvent && event.original.button !== 0) {
        return;
      }

      this.draggedNode = node;
      camera.disable();

      event.preventSigmaDefault();
      event.original.preventDefault();

      this.container.nativeElement.style.cursor = 'grabbing';
    });

    renderer.getMouseCaptor().on('mousemove', (e) => {
      if (!this.draggedNode) return;

      const { x, y } = renderer.viewportToGraph(e);

      this.graph.setNodeAttribute(this.draggedNode, 'x', x);
      this.graph.setNodeAttribute(this.draggedNode, 'y', y);

      renderer.refresh();
    });

    const drop = () => {
      if (this.draggedNode) {
        this.draggedNode = null;
        camera.enable();
        this.container.nativeElement.style.cursor = 'grab';
      }
    };

    renderer.getMouseCaptor().on('mouseup', drop);
    renderer.getMouseCaptor().on('mouseleave', drop);
    renderer.on('clickStage', drop);
  }

  private setupHoverEffects(
    renderer: Sigma<NodeAttributes, EdgeAttributes>
  ): void {
    renderer.on('enterNode', ({ node }) => {
      if (this.enhancedHoverEnabled) {
        this.hoveredNode = node;
        this.highlightNodeCluster(node);
      } else {
        this.graph.setNodeAttribute(node, 'highlighted', true);
        this.graph.setNodeAttribute(node, 'size', 25);
        renderer.refresh();
      }
      this.container.nativeElement.style.cursor = 'pointer';
    });

    renderer.on('leaveNode', ({ node }) => {
      if (this.enhancedHoverEnabled) {
        this.hoveredNode = null;
        this.resetAllHighlights();
      } else {
        this.graph.setNodeAttribute(node, 'highlighted', false);
        this.graph.setNodeAttribute(node, 'size', 20);
        renderer.refresh();
      }
      this.container.nativeElement.style.cursor = 'grab';
    });
  }

  private highlightNodeCluster(centerNode: string): void {
    const neighbors = this.graph.neighbors(centerNode);
    const connectedNodes = new Set([centerNode, ...neighbors]);

    const connectedEdges = new Set([
      ...this.graph.inboundEdges(centerNode),
      ...this.graph.outboundEdges(centerNode),
    ]);

    this.graph.nodes().forEach((node) => {
      if (node === centerNode) {
        this.graph.setNodeAttribute(node, 'size', 30);
        this.graph.setNodeAttribute(node, 'highlighted', true);
      } else if (connectedNodes.has(node)) {
        this.graph.setNodeAttribute(node, 'size', 25);
        this.graph.setNodeAttribute(node, 'highlighted', true);
      } else {
        this.graph.setNodeAttribute(node, 'size', 15);
        this.graph.setNodeAttribute(node, 'color', '#cccccc');
        this.graph.setNodeAttribute(node, 'highlighted', false);
      }
    });

    this.graph.edges().forEach((edge) => {
      if (connectedEdges.has(edge)) {
        this.graph.setEdgeAttribute(edge, 'color', '#ff6b6b');
        this.graph.setEdgeAttribute(edge, 'size', 4);
      } else {
        this.graph.setEdgeAttribute(edge, 'color', '#e0e0e0');
        this.graph.setEdgeAttribute(edge, 'size', 1);
      }
    });

    this.startPulsingAnimation(connectedEdges);

    this.sigma?.refresh();
  }

  private resetAllHighlights(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    const currentDataset = this.datasets[this.currentDatasetIndex];

    const colorByLabel: Record<NodeLabel, string> = {
      EVENT: '#e67e22',
      VEHICLE: '#27ae60',
      ADDRESS: '#45b7d1',
      GROUP: '#8e44ad',
    };

    this.graph.nodes().forEach((nodeId) => {
      const originalNode = currentDataset.nodes.find((n) => n.id === nodeId);
      const fallback =
        (this.graph.getNodeAttribute(nodeId, 'color') as string) ||
        (GRAPH_CONFIG.renderer?.defaultNodeColor ?? '#999');
      const baseColor = originalNode
        ? colorByLabel[originalNode.label] ?? fallback
        : fallback;

      this.graph.setNodeAttribute(
        nodeId,
        'size',
        GRAPH_CONFIG.defaults.node.size
      );
      this.graph.setNodeAttribute(nodeId, 'color', baseColor);
      this.graph.setNodeAttribute(nodeId, 'highlighted', false);
    });

    this.graph.edges().forEach((edge) => {
      this.graph.setEdgeAttribute(
        edge,
        'color',
        GRAPH_CONFIG.defaults.edge.color
      );
      this.graph.setEdgeAttribute(
        edge,
        'size',
        GRAPH_CONFIG.defaults.edge.size
      );
    });

    this.sigma?.refresh();
  }

  private startPulsingAnimation(connectedEdges: Set<string>): void {
    let time = 0;

    const animate = () => {
      if (!this.hoveredNode) return;

      time += 0.1;
      const intensity = (Math.sin(time) + 1) / 2;

      connectedEdges.forEach((edge) => {
        const r = Math.floor(255 - intensity * 150);
        const g = Math.floor(107 + intensity * 100);
        const b = Math.floor(107 + intensity * 100);

        this.graph.setEdgeAttribute(edge, 'color', `rgb(${r}, ${g}, ${b})`);
        this.graph.setEdgeAttribute(edge, 'size', 3 + intensity * 2);
      });

      this.sigma?.refresh();
      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  private setupClickEvents(
    renderer: Sigma<NodeAttributes, EdgeAttributes>
  ): void {
    renderer.on('clickNode', ({ node, event }) => {
      this.hideContextMenu();
    });

    renderer.on('rightClickNode', ({ node, event }) => {
      event.preventSigmaDefault();
      event.original.preventDefault();

      this.showContextMenu(node, event.original as MouseEvent);
    });

    renderer.on('clickStage', () => {
      this.hideContextMenu();
    });

    renderer.on('doubleClickStage', ({ event }) => {
      event.preventSigmaDefault();
      event.original.preventDefault();
    });

    renderer.on('doubleClickNode', ({ event }) => {
      event.preventSigmaDefault();
      event.original.preventDefault();
    });

    this.container.nativeElement.addEventListener('wheel', () => {
      this.hideContextMenu();
    });
  }

  showContextMenu(nodeId: string, event: MouseEvent): void {
    this.contextMenuEdges = this.buildContextMenuEdges(nodeId);
    this.selectedEdgeId = this.contextMenuEdges.length
      ? this.contextMenuEdges[0].id
      : null;
    this.showRelationDeletePanel = false;
    this.showRelationCreatePanel = false;
    this.contextMenu = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      nodeId: nodeId,
    };
  }

  openRelationDeletePanel(): void {
    if (!this.contextMenu.nodeId) return;
    this.contextMenuEdges = this.buildContextMenuEdges(this.contextMenu.nodeId);
    this.selectedEdgeId = this.contextMenuEdges.length
      ? this.contextMenuEdges[0].id
      : null;
    this.showRelationDeletePanel = true;
  }

  hideContextMenu(): void {
    this.contextMenu.visible = false;
    this.contextMenu.nodeId = null;
    this.showRelationCreatePanel = false;
    this.showRelationDeletePanel = false;
    this.relationLabelInput = '';
  }

  isNodeExpanded(nodeId: string): boolean {
    return this.expandedNodes.has(nodeId);
  }

  getExpandableChildrenCount(nodeId: string): number {
    if (this.nodeChildrenCount.has(nodeId)) {
      return this.nodeChildrenCount.get(nodeId)!;
    }

    const baseCount = 3;
    const variation = Math.floor(Math.random() * 4);
    const count = baseCount + variation;

    this.nodeChildrenCount.set(nodeId, count);
    return count;
  }

  private findSafePositionForChild(
    parentX: number,
    parentY: number,
    childIndex: number,
    totalChildren: number
  ): { x: number; y: number } {
    const order = Math.max(this.graph.order, 1);
    const base = 260 + Math.log1p(order) * 60;
    const angle = childIndex * 2.399963229728653;
    const radius = base + (childIndex % 8) * 30;
    return {
      x: parentX + Math.cos(angle) * radius,
      y: parentY + Math.sin(angle) * radius,
    };
  }

  private layoutSnapshots: Map<string, Record<string, [number, number]>> =
    new Map();

  private async fetchExpandedGraph(nodeId: string): Promise<{
    nodes: DatasetNode[];
    relations: DatasetEdge[];
  }> {
    const count = this.getExpandableChildrenCount(nodeId);
    const labels: NodeLabel[] = ['EVENT', 'VEHICLE', 'ADDRESS', 'GROUP'];
    const nodes: DatasetNode[] = [];
    const relations: DatasetEdge[] = [];

    for (let i = 0; i < count; i++) {
      const now = new Date().toISOString();
      const id = `${nodeId}_child_${this.nextNodeId++}`;
      const label = labels[Math.floor(Math.random() * labels.length)];

      const displayName: MultiValue<string> = {
        values: [
          {
            system: 'demo',
            insertionAt: now,
            value: `Child ${i + 1}`,
          },
        ],
      };

      const properties: NodeProperties = {
        is_deleted: false,
        displayName,
        NODE_ID: id,
      };

      nodes.push({ id, label, properties });

      relations.push({
        id: `rel_${this.nextNodeId++}`,
        startNodeID: nodeId,
        endNodeID: id,
        properties: {
          createdAt: now,
          is_deleted: false,
          RELATION_ID: 'expands to',
        },
      });

      const existing = this.graph
        .nodes()
        .filter((n) => n !== nodeId && n !== id);
      const extraLinks = Math.floor(Math.random() * 3);
      for (let k = 0; k < extraLinks && existing.length > 0; k++) {
        const target = existing[Math.floor(Math.random() * existing.length)];
        const start = Math.random() < 0.5 ? id : target;
        const end = start === id ? target : id;

        relations.push({
          id: `rel_${this.nextNodeId++}`,
          startNodeID: start,
          endNodeID: end,
          properties: {
            createdAt: now,
            is_deleted: false,
            RELATION_ID: 'related',
          },
        });
      }
    }

    return { nodes, relations };
  }

  async expandNode(nodeId: string): Promise<void> {
    if (this.isNodeExpanded(nodeId)) return;

    const snapshot: Record<string, [number, number]> = {};
    this.graph.nodes().forEach((id) => {
      const x = this.graph.getNodeAttribute(id, 'x') || 0;
      const y = this.graph.getNodeAttribute(id, 'y') || 0;
      snapshot[id] = [x, y];
    });
    this.layoutSnapshots.set(nodeId, snapshot);

    const beforeNodes = new Set(this.graph.nodes());

    try {
      const { nodes, relations } = await this.fetchExpandedGraph(nodeId);

      this.addNodesToGraph(nodes ?? [], nodeId);
      this.addEdgesToGraph(relations ?? []);

      const newNodes: string[] = [];
      (nodes ?? []).forEach((n) => {
        if (!beforeNodes.has(n.id) && this.graph.hasNode(n.id)) {
          newNodes.push(n.id);
        }
      });

      this.expandedNodes.set(nodeId, {
        nodeId,
        expandedChildren: newNodes,
      });

      this.hideContextMenu();
      this.applyLayout();
    } catch (e) {
      console.error('expandNode failed', e);
    }
  }

  collapseNode(nodeId: string): void {
    const expandedNode = this.expandedNodes.get(nodeId);
    if (!expandedNode) return;

    expandedNode.expandedChildren.forEach((childId) => {
      const connectedEdges = [
        ...this.graph.inboundEdges(childId),
        ...this.graph.outboundEdges(childId),
      ];

      connectedEdges.forEach((edge) => {
        if (this.graph.hasEdge(edge)) {
          this.graph.dropEdge(edge);
        }
      });

      if (this.graph.hasNode(childId)) {
        this.graph.dropNode(childId);
      }
    });

    this.expandedNodes.delete(nodeId);

    const snapshot = this.layoutSnapshots.get(nodeId);
    if (snapshot) {
      Object.keys(snapshot).forEach((id) => {
        if (this.graph.hasNode(id)) {
          const [x, y] = snapshot[id];
          this.graph.setNodeAttribute(id, 'x', x);
          this.graph.setNodeAttribute(id, 'y', y);
        }
      });
      this.layoutSnapshots.delete(nodeId);
    }

    this.hideContextMenu();
    this.sigma?.refresh();
  }

  deleteNodeFromContextMenu(): void {
    const id = this.contextMenu.nodeId;
    if (id) this.deleteNode(id);
  }

  deleteNode(nodeId: string): void {
    if (!nodeId || !this.graph.hasNode(nodeId)) return;
    this.dropNodeAndCleanup(nodeId);
    this.hideContextMenu();
    this.applyLayout();
  }

  deleteNodeKeepChildrenFromContextMenu(): void {
    const id = this.contextMenu.nodeId;
    if (id) this.deleteNodeKeepChildren(id);
  }

  deleteNodeKeepChildren(nodeId: string): void {
    if (!nodeId || !this.graph.hasNode(nodeId)) return;
    this.dropNodeOnly(nodeId);
    this.hideContextMenu();
    this.applyLayout();
  }

  private dropNodeOnly(nodeId: string): void {
    if (!this.graph.hasNode(nodeId)) return;

    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId);
      this.layoutSnapshots.delete(nodeId);
    }

    for (const [anchor, data] of this.expandedNodes.entries()) {
      const filtered = data.expandedChildren.filter((id) => id !== nodeId);
      if (filtered.length !== data.expandedChildren.length) {
        this.expandedNodes.set(anchor, {
          nodeId: data.nodeId,
          expandedChildren: filtered,
        });
      }
    }

    this.nodeChildrenCount.delete(nodeId);
    for (const snapshot of this.layoutSnapshots.values()) {
      delete snapshot[nodeId as keyof typeof snapshot];
    }

    const edges = [
      ...this.graph.inboundEdges(nodeId),
      ...this.graph.outboundEdges(nodeId),
    ];
    edges.forEach((e) => this.graph.hasEdge(e) && this.graph.dropEdge(e));

    this.graph.dropNode(nodeId);

    if (this.hoveredNode === nodeId) this.hoveredNode = null;
  }

  private dropNodeAndCleanup(nodeId: string): void {
    if (!this.graph.hasNode(nodeId)) return;

    if (this.expandedNodes.has(nodeId)) {
      const children = [...this.expandedNodes.get(nodeId)!.expandedChildren];
      children.forEach((childId) => this.dropNodeAndCleanup(childId));
      this.expandedNodes.delete(nodeId);
      this.layoutSnapshots.delete(nodeId);
    }

    for (const [anchor, data] of this.expandedNodes.entries()) {
      const filtered = data.expandedChildren.filter((id) => id !== nodeId);
      if (filtered.length !== data.expandedChildren.length) {
        this.expandedNodes.set(anchor, {
          nodeId: data.nodeId,
          expandedChildren: filtered,
        });
      }
    }

    this.nodeChildrenCount.delete(nodeId);
    for (const snapshot of this.layoutSnapshots.values()) {
      delete snapshot[nodeId as keyof typeof snapshot];
    }

    const connectedEdges = [
      ...this.graph.inboundEdges(nodeId),
      ...this.graph.outboundEdges(nodeId),
    ];
    connectedEdges.forEach((edge) => {
      if (this.graph.hasEdge(edge)) this.graph.dropEdge(edge);
    });

    this.graph.dropNode(nodeId);

    if (this.hoveredNode === nodeId) this.hoveredNode = null;
  }

  startRelationFromContextMenu(): void {
    if (!this.contextMenu.nodeId) return;
    this.relationDraftSource = this.contextMenu.nodeId;
    this.hideContextMenu();
  }

  connectRelationToContextMenu(): void {
    if (!this.relationDraftSource || !this.contextMenu.nodeId) return;
    const source = this.relationDraftSource;
    const target = this.contextMenu.nodeId;
    if (source === target) {
      this.relationDraftSource = null;
      this.hideContextMenu();
      return;
    }
    this.relationLabelInput = '';
    this.showRelationCreatePanel = true;
  }

  confirmCreateRelation(): void {
    if (!this.relationDraftSource || !this.contextMenu.nodeId) return;
    const label = this.relationLabelInput.trim();
    if (!label) return;
    this.createRelation(
      this.relationDraftSource,
      this.contextMenu.nodeId,
      label
    );
    this.relationDraftSource = null;
    this.relationLabelInput = '';
    this.showRelationCreatePanel = false;
    this.hideContextMenu();
    this.applyLayout();
  }

  cancelRelationCreate(): void {
    this.relationLabelInput = '';
    this.showRelationCreatePanel = false;
  }

  cancelRelationDraft(): void {
    this.relationDraftSource = null;
    this.hideContextMenu();
  }

  private createRelation(
    sourceId: string,
    targetId: string,
    relLabel: string
  ): void {
    if (!this.graph.hasNode(sourceId) || !this.graph.hasNode(targetId)) return;
    if (
      this.graph.hasEdge(sourceId, targetId) ||
      this.graph.hasEdge(targetId, sourceId)
    ) {
      this.sigma?.refresh();
      return;
    }
    const edgeId = `rel_${this.nextNodeId++}`;
    this.graph.addEdgeWithKey(edgeId, sourceId, targetId, {
      color: GRAPH_CONFIG.defaults.edge.color,
      size: GRAPH_CONFIG.defaults.edge.size,
      animated: GRAPH_CONFIG.defaults.edge.animated,
      label: relLabel,
    });
    this.sigma?.refresh();
  }

  private getNodeDisplay(nodeId: string): string {
    const lbl = this.graph.getNodeAttribute(nodeId, 'label') as
      | string
      | undefined;
    return lbl && lbl.length ? lbl : nodeId;
  }

  private buildContextMenuEdges(
    nodeId: string
  ): { id: string; text: string }[] {
    if (!this.graph.hasNode(nodeId)) return [];
    const edges = this.graph.edges(nodeId);
    return edges.map((eid) => {
      const [a, b] = this.graph.extremities(eid) as [string, string];
      const la = this.getNodeDisplay(a);
      const lb = this.getNodeDisplay(b);
      const elabel =
        (this.graph.getEdgeAttribute(eid, 'label') as string | undefined) ||
        'relation';
      return { id: eid, text: `${elabel}: ${la} → ${lb}` };
    });
  }

  deleteSelectedRelation(): void {
    const id = this.selectedEdgeId;
    if (id && this.graph.hasEdge(id)) {
      this.graph.dropEdge(id);
      this.sigma?.refresh();
    }
    this.showRelationDeletePanel = false;
    this.hideContextMenu();
  }

  cancelRelationDelete(): void {
    this.showRelationDeletePanel = false;
  }

  deleteRelationFromMenu(edgeId: string): void {
    if (edgeId && this.graph.hasEdge(edgeId)) {
      this.graph.dropEdge(edgeId);
      this.hideContextMenu();
      this.sigma?.refresh();
    }
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.sigma) {
      this.sigma.kill();
    }
  }
}
