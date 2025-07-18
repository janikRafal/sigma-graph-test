import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Sigma from 'sigma';
import Graph from 'graphology';
import { Attributes } from 'graphology-types';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import { GRAPH_DATASETS } from './graph-datasets';
import { GRAPH_CONFIG } from './graph-config';
import { NodeImageProgram } from '@sigma/node-image';

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

interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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
    if (this.sigma) {
      this.sigma.refresh();

      setTimeout(() => {
        this.resetGraphPosition();
      }, 100);
    }
  }

  onHoverModeChange(): void {
    if (this.sigma) {
      this.resetAllHighlights();
    }
  }

  resetGraphPosition(): void {
    if (this.sigma) {
      const camera = this.sigma.getCamera();

      const bounds = this.getBounds();

      if (bounds) {
        const { minX, maxX, minY, maxY } = bounds;
        const graphWidth = maxX - minX;
        const graphHeight = maxY - minY;

        const { width, height } = this.sigma.getDimensions();

        const margin = 0.15;
        const scaleX = (width * (1 - margin)) / graphWidth;
        const scaleY = (height * (1 - margin)) / graphHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        const targetState = {
          x: 0.5,
          y: 0.5,
          ratio: Math.max(1 / scale, 0.1),
        };

        camera.animate(targetState, {
          duration: 500,
        });
      }
    }
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
      this.sigma.refresh();

      setTimeout(() => {
        this.resetGraphPosition();
      }, 200);
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
    const { nodes, edges } = currentDataset;

    this.addNodesToGraph(nodes);
    this.addEdgesToGraph(edges);
    this.applyLayout();
  }

  private addNodesToGraph(nodes: any[]): void {
    nodes.forEach((node, index) => {
      const angle = (index * 2 * Math.PI) / nodes.length;
      this.graph.addNode(node.id, {
        label: node.label,
        size: GRAPH_CONFIG.defaults.node.size,
        color: node.color,
        highlighted: GRAPH_CONFIG.defaults.node.highlighted,
        image: node.image,
        type: node.image ? 'image' : 'circle',
        x: Math.cos(angle) * 120,
        y: Math.sin(angle) * 120,
      });
    });
  }

  private addEdgesToGraph(edges: any[]): void {
    edges.forEach((edge) => {
      this.graph.addEdge(edge.from, edge.to, {
        color: GRAPH_CONFIG.defaults.edge.color,
        size: GRAPH_CONFIG.defaults.edge.size,
        animated: GRAPH_CONFIG.defaults.edge.animated,
        label: edge.label,
      });
    });
  }

  private applyLayout(): void {
    forceAtlas2.assign(this.graph, GRAPH_CONFIG.layout);
  }

  ngAfterViewInit(): void {
    try {
      this.initializeSigma();
      this.setupInteractions();
    } catch (error) {
      console.error('Failed to initialize Sigma:', error);
    }
  }

  private initializeSigma(): void {
    this.sigma = new Sigma(this.graph, this.container.nativeElement, {
      ...GRAPH_CONFIG.renderer,
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
    camera: any
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

    this.graph.nodes().forEach((node) => {
      const dataset = this.datasets[this.currentDatasetIndex];
      const originalNode = dataset.nodes.find((n) => n.id === node);

      this.graph.setNodeAttribute(node, 'size', 20);
      this.graph.setNodeAttribute(node, 'color', originalNode?.color || '#999');
      this.graph.setNodeAttribute(node, 'highlighted', false);
    });

    this.graph.edges().forEach((edge) => {
      this.graph.setEdgeAttribute(edge, 'color', '#cccccc');
      this.graph.setEdgeAttribute(edge, 'size', 2);
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
    this.contextMenu = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      nodeId: nodeId,
    };
  }

  hideContextMenu(): void {
    this.contextMenu.visible = false;
    this.contextMenu.nodeId = null;
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
    const minDistance = 10;
    const baseRadius = 40;
    const maxAttempts = 20;

    const baseAngle = (childIndex * 2 * Math.PI) / totalChildren;

    for (let radiusMultiplier = 1; radiusMultiplier <= 3; radiusMultiplier++) {
      const radius = baseRadius * radiusMultiplier;

      for (let angleOffset = 0; angleOffset < maxAttempts; angleOffset++) {
        const angleStep =
          (Math.PI / 8) *
          (angleOffset % 2 === 0 ? angleOffset / 2 : -(angleOffset + 1) / 2);
        const angle = baseAngle + angleStep;

        const candidateX = parentX + Math.cos(angle) * radius;
        const candidateY = parentY + Math.sin(angle) * radius;

        if (this.isPositionSafe(candidateX, candidateY, minDistance)) {
          return { x: candidateX, y: candidateY };
        }
      }
    }

    const fallbackRadius = baseRadius * 2.5;
    const fallbackAngle = baseAngle;
    return {
      x: parentX + Math.cos(fallbackAngle) * fallbackRadius,
      y: parentY + Math.sin(fallbackAngle) * fallbackRadius,
    };
  }

  private isPositionSafe(x: number, y: number, minDistance: number): boolean {
    for (const nodeId of this.graph.nodes()) {
      const nodeX = this.graph.getNodeAttribute(nodeId, 'x') || 0;
      const nodeY = this.graph.getNodeAttribute(nodeId, 'y') || 0;
      const nodeSize = this.graph.getNodeAttribute(nodeId, 'size') || 20;

      const distance = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
      const requiredDistance = minDistance + nodeSize / 2;

      if (distance < requiredDistance) {
        return false;
      }
    }
    return true;
  }

  expandNode(nodeId: string): void {
    if (this.isNodeExpanded(nodeId)) return;

    const childrenCount = this.getExpandableChildrenCount(nodeId);
    const expandedChildren: string[] = [];

    const parentX = this.graph.getNodeAttribute(nodeId, 'x') || 0;
    const parentY = this.graph.getNodeAttribute(nodeId, 'y') || 0;

    for (let i = 0; i < childrenCount; i++) {
      const childId = `${nodeId}_child_${this.nextNodeId++}`;

      const childPosition = this.findSafePositionForChild(
        parentX,
        parentY,
        i,
        childrenCount
      );

      this.graph.addNode(childId, {
        label: `Child ${i + 1}`,
        size: 15,
        color: '#ff9f43',
        x: childPosition.x,
        y: childPosition.y,
        highlighted: false,
      });

      this.graph.addEdge(nodeId, childId, {
        color: '#cccccc',
        size: 2,
        label: 'expands to',
      });

      expandedChildren.push(childId);
    }

    this.expandedNodes.set(nodeId, {
      nodeId: nodeId,
      expandedChildren: expandedChildren,
    });

    this.hideContextMenu();
    this.sigma?.refresh();
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

    this.hideContextMenu();
    this.sigma?.refresh();
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
