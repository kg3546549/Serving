import type { ArchitectureNodeId } from "../simulation/trafficSimulation";
import * as React from "react";

export interface DeviceIconMeta {
  nodeId: ArchitectureNodeId;
  name: string;
  reactRender: (color?: string, strokeWidth?: number) => React.JSX.Element;
  drawPhaser: (graphics: any, color?: number, strokeWidth?: number) => void;
}

export const DEVICE_ICON_META: Record<ArchitectureNodeId, DeviceIconMeta> = {
  entry: {
    nodeId: "entry",
    name: "Traffic Ingress",
    reactRender: (color = "currentColor", strokeWidth = 3.5) => (
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
        <circle cx="15" cy="16" r="6.5" />
        <circle cx="33" cy="16" r="6.5" />
        <path d="M5 39c0-5 4-9 9-9h2c2.5 0 4.8 1 6.5 2.6M43 39c0-5-4-9-9-9h-2c-2.5 0-4.8 1-6.5 2.6" />
      </svg>
    ),
    drawPhaser: (graphics, color = 0xffffff, strokeWidth = 3.5) => {
      graphics.lineStyle(strokeWidth, color, 1);
      // 왼쪽 사람 머리 & 어깨 아크
      graphics.strokeCircle(-9, -6, 6.5);
      graphics.beginPath();
      graphics.arc(-10, 18, 11, Math.PI * 1.08, Math.PI * 1.92);
      graphics.strokePath();
      
      // 오른쪽 사람 머리 & 어깨 아크
      graphics.strokeCircle(9, -6, 6.5);
      graphics.beginPath();
      graphics.arc(10, 18, 11, Math.PI * 1.08, Math.PI * 1.92);
      graphics.strokePath();
    }
  },
  exit: {
    nodeId: "exit",
    name: "Response Egress",
    reactRender: (color = "currentColor", strokeWidth = 4) => (
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
        <circle cx="24" cy="24" r="16" />
        <path d="m17 24 5 5 10-10" />
      </svg>
    ),
    drawPhaser: (graphics, color = 0xffffff, strokeWidth = 4) => {
      graphics.lineStyle(strokeWidth, color, 1);
      graphics.strokeCircle(0, 0, 16);
      graphics.lineBetween(-7, 0, -2, 5);
      graphics.lineBetween(-2, 5, 8, -5);
    }
  },
  loadBalancer: {
    nodeId: "loadBalancer",
    name: "Load Balancer",
    reactRender: (color = "currentColor", strokeWidth = 3.5) => (
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
        <rect x="16" y="16" width="16" height="16" rx="3" />
        <path d="M24 4v12M24 32v12M4 24h12M32 24h12" />
        <path d="m19 9 5-5 5 5M39 19l5 5-5 5M19 39l5 5 5-5M9 19l-5 5 5 5" />
      </svg>
    ),
    drawPhaser: (graphics, color = 0xffffff, strokeWidth = 3.5) => {
      graphics.lineStyle(strokeWidth, color, 1);
      // 중앙 라운드 사각형
      graphics.strokeRoundedRect(-8, -8, 16, 16, 3);
      // 4방향 분산선
      graphics.lineBetween(0, -24, 0, -8);
      graphics.lineBetween(0, 8, 0, 24);
      graphics.lineBetween(-24, 0, -8, 0);
      graphics.lineBetween(8, 0, 24, 0);
      // 화살표 머리들
      graphics.lineBetween(-5, -19, 0, -24);
      graphics.lineBetween(5, -19, 0, -24);
      
      graphics.lineBetween(19, -5, 24, 0);
      graphics.lineBetween(19, 5, 24, 0);
      
      graphics.lineBetween(-5, 19, 0, 24);
      graphics.lineBetween(5, 19, 0, 24);
      
      graphics.lineBetween(-19, -5, -24, 0);
      graphics.lineBetween(-19, 5, -24, 0);
    }
  },
  serverA: {
    nodeId: "serverA",
    name: "App Server A",
    reactRender: (color = "currentColor", strokeWidth = 3.5) => (
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
        <rect x="9" y="10" width="30" height="23" rx="3" />
        <path d="M15 39h18M24 33v6" />
        <path d="M14 16h20M14 22h13M14 28h15" />
        <circle cx="31" cy="22" r="1.2" fill={color} />
      </svg>
    ),
    drawPhaser: (graphics, color = 0xffffff, strokeWidth = 3.5) => {
      graphics.lineStyle(strokeWidth, color, 1);
      // 모니터 사각형 (x, y, w, h, rx)
      graphics.strokeRoundedRect(-15, -17, 30, 23, 3);
      // 스탠드/발판
      graphics.lineBetween(-9, 15, 9, 15);
      graphics.lineBetween(0, 9, 0, 15);
      // 내부 텍스트 선
      graphics.lineBetween(-10, -11, 10, -11);
      graphics.lineBetween(-10, -5, 3, -5);
      graphics.lineBetween(-10, 1, 5, 1);
      // LED 전원 램프
      graphics.fillStyle(color, 1);
      graphics.fillCircle(7, -5, 1.5);
    }
  },
  serverB: {
    nodeId: "serverB",
    name: "App Server B",
    reactRender: (color = "currentColor", strokeWidth = 3.5) => (
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
        <rect x="9" y="10" width="30" height="23" rx="3" />
        <path d="M15 39h18M24 33v6" />
        <path d="M14 16h20M14 22h13M14 28h15" />
        <circle cx="31" cy="22" r="1.2" fill={color} />
      </svg>
    ),
    drawPhaser: (graphics, color = 0xffffff, strokeWidth = 3.5) => {
      graphics.lineStyle(strokeWidth, color, 1);
      graphics.strokeRoundedRect(-15, -17, 30, 23, 3);
      graphics.lineBetween(-9, 15, 9, 15);
      graphics.lineBetween(0, 9, 0, 15);
      graphics.lineBetween(-10, -11, 10, -11);
      graphics.lineBetween(-10, -5, 3, -5);
      graphics.lineBetween(-10, 1, 5, 1);
      graphics.fillStyle(color, 1);
      graphics.fillCircle(7, -5, 1.5);
    }
  },
  database: {
    nodeId: "database",
    name: "Primary DB",
    reactRender: (color = "currentColor", strokeWidth = 3.5) => (
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
        <ellipse cx="24" cy="11" rx="14" ry="5.5" />
        <path d="M10 11v25c0 3 6.3 5.5 14 5.5s14-2.5 14-5.5V11M10 23c0 3 6.3 5.5 14 5.5s14-2.5 14-5.5" />
      </svg>
    ),
    drawPhaser: (graphics, color = 0xffffff, strokeWidth = 3.5) => {
      graphics.lineStyle(strokeWidth, color, 1);
      // 3단 실린더 모양 (strokeEllipse & lineBetween)
      graphics.strokeEllipse(0, -13, 28, 11);
      graphics.strokeEllipse(0, -1, 28, 11);
      graphics.strokeEllipse(0, 12, 28, 11);
      
      graphics.lineBetween(-14, -13, -14, 12);
      graphics.lineBetween(14, -13, 14, 12);
    }
  }
};
