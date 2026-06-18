export type NetworkProtocol =
  | "HTTPS"
  | "TCP"
  | "WebSocket"
  | "MQTT"
  | "HLS"
  | "DASH"
  | "RTMP"
  | "SRT"
  | "RTSP";

export type RequestOperation = "read" | "write" | "slowRead";

export interface WaveDefinition {
  id: number;
  name: string;
  description: string;
  protocol: NetworkProtocol;
  requestCount: number;
  spawnDurationMs: number;
  targetSuccessRate: number;
  deadlineMs: number;
  writeEvery?: number;
  slowQueryEvery?: number;
}

export interface CampaignStageDefinition {
  id: number;
  name: string;
  domain: string;
  difficulty: number;
  protocols: NetworkProtocol[];
  architectureLesson: string;
  serverLogicLesson: string;
  enemyDesign: string[];
  equipmentDesign: string[];
  waves?: readonly WaveDefinition[];
}

export const STAGE_ONE_WAVES: readonly WaveDefinition[] = [
  {
    id: 1,
    name: "첫 Health Check",
    description: "HTTPS GET 요청이 서버와 DB를 거쳐 응답으로 돌아와야 합니다.",
    protocol: "HTTPS",
    requestCount: 6,
    spawnDurationMs: 18_000,
    targetSuccessRate: 0.9,
    deadlineMs: 6_000,
  },
  {
    id: 2,
    name: "사용자 조회",
    description: "읽기 요청이 일정한 간격으로 유입됩니다.",
    protocol: "HTTPS",
    requestCount: 12,
    spawnDurationMs: 18_000,
    targetSuccessRate: 0.9,
    deadlineMs: 6_000,
  },
  {
    id: 3,
    name: "데이터 저장",
    description: "POST 쓰기 요청이 추가되어 DB 점유 시간이 길어집니다.",
    protocol: "HTTPS",
    requestCount: 18,
    spawnDurationMs: 18_000,
    targetSuccessRate: 0.85,
    deadlineMs: 6_000,
    writeEvery: 3,
  },
  {
    id: 4,
    name: "점심시간 트래픽",
    description: "요청 간격이 짧아져 단일 서버 Queue가 차오르기 시작합니다.",
    protocol: "HTTPS",
    requestCount: 24,
    spawnDurationMs: 16_000,
    targetSuccessRate: 0.82,
    deadlineMs: 6_000,
    writeEvery: 4,
  },
  {
    id: 5,
    name: "수평 확장 시험",
    description: "Load Balancer와 두 번째 App Server가 필요한 첫 폭주입니다.",
    protocol: "HTTPS",
    requestCount: 34,
    spawnDurationMs: 16_000,
    targetSuccessRate: 0.82,
    deadlineMs: 6_000,
    writeEvery: 4,
  },
  {
    id: 6,
    name: "혼합 API",
    description: "GET과 POST가 동시에 몰려 서버와 DB가 함께 압박받습니다.",
    protocol: "HTTPS",
    requestCount: 38,
    spawnDurationMs: 17_000,
    targetSuccessRate: 0.82,
    deadlineMs: 6_000,
    writeEvery: 2,
  },
  {
    id: 7,
    name: "느린 검색",
    description: "인덱스가 없는 느린 조회가 DB Queue를 점유합니다.",
    protocol: "HTTPS",
    requestCount: 38,
    spawnDurationMs: 18_000,
    targetSuccessRate: 0.8,
    deadlineMs: 6_400,
    writeEvery: 4,
    slowQueryEvery: 7,
  },
  {
    id: 8,
    name: "DB 병목",
    description: "App Server를 늘려도 DB가 느리면 응답이 돌아오지 못합니다.",
    protocol: "HTTPS",
    requestCount: 44,
    spawnDurationMs: 18_000,
    targetSuccessRate: 0.82,
    deadlineMs: 6_400,
    writeEvery: 3,
    slowQueryEvery: 6,
  },
  {
    id: 9,
    name: "프로모션 오픈",
    description: "읽기·쓰기·느린 조회가 짧은 간격으로 섞여 들어옵니다.",
    protocol: "HTTPS",
    requestCount: 50,
    spawnDurationMs: 19_000,
    targetSuccessRate: 0.84,
    deadlineMs: 6_500,
    writeEvery: 3,
    slowQueryEvery: 8,
  },
  {
    id: 10,
    name: "출시일 Boss Wave",
    description: "Stage 1의 전체 요청 유형을 처리하고 응답까지 반환하세요.",
    protocol: "HTTPS",
    requestCount: 60,
    spawnDurationMs: 20_000,
    targetSuccessRate: 0.85,
    deadlineMs: 6_800,
    writeEvery: 3,
    slowQueryEvery: 7,
  },
] as const;

export const CAMPAIGN_STAGES: readonly CampaignStageDefinition[] = [
  {
    id: 1,
    name: "기본 HTTPS API",
    domain: "단일 웹 API와 관계형 DB",
    difficulty: 1,
    protocols: ["HTTPS"],
    architectureLesson: "Ingress → App Server → Primary DB의 최소 요청 경로",
    serverLogicLesson: "GET 조회, POST 저장, 상태 코드와 응답 반환",
    enemyDesign: ["GET 읽기", "POST 쓰기", "느린 DB 조회", "Burst 묶음"],
    equipmentDesign: [
      "App Server",
      "Primary DB",
      "Load Balancer",
      "App Server 증설",
      "DB Index",
    ],
    waves: STAGE_ONE_WAVES,
  },
  {
    id: 2,
    name: "WEB / WAS 분리",
    domain: "정적 웹과 동적 애플리케이션",
    difficulty: 2,
    protocols: ["HTTPS"],
    architectureLesson: "Web Server와 WAS를 분리하고 경로별로 라우팅",
    serverLogicLesson: "정적 파일 응답과 동적 API 실행의 차이",
    enemyDesign: ["정적 Asset", "동적 API", "대용량 Bundle", "Session 요청"],
    equipmentDesign: ["Web Server", "WAS", "L7 Router", "Session Store"],
  },
  {
    id: 3,
    name: "콘텐츠 전송",
    domain: "Object Storage와 CDN",
    difficulty: 3,
    protocols: ["HTTPS"],
    architectureLesson: "원본 저장소 앞에 Cache와 CDN을 배치",
    serverLogicLesson: "Cache key, TTL, Range 요청, Origin 응답",
    enemyDesign: ["Cache Hit", "Cache Miss", "대용량 다운로드", "Hot Object"],
    equipmentDesign: ["Object Storage", "Cache", "CDN Edge", "Origin Shield"],
  },
  {
    id: 4,
    name: "IoT Telemetry",
    domain: "MQTT Broker와 시계열 수집",
    difficulty: 4,
    protocols: ["MQTT", "TCP"],
    architectureLesson: "Broker → Stream Buffer → Consumer → Time-series DB",
    serverLogicLesson: "Topic, QoS, Retain, 재연결과 중복 메시지 처리",
    enemyDesign: ["QoS 0 센서", "QoS 1 재전송", "Retained 상태", "연결 폭주"],
    equipmentDesign: ["MQTT Broker", "Topic Router", "Consumer", "Time-series DB"],
  },
  {
    id: 5,
    name: "실시간 양방향 서비스",
    domain: "WebSocket 채팅·게임 세션",
    difficulty: 5,
    protocols: ["WebSocket", "TCP", "HTTPS"],
    architectureLesson: "Handshake 경로와 장기 연결 처리 노드를 분리",
    serverLogicLesson: "세션 유지, Ping/Pong, Fan-out, 순서 보장",
    enemyDesign: ["Handshake", "장기 연결", "Broadcast", "Reconnect Storm"],
    equipmentDesign: ["WebSocket Gateway", "Session Server", "Pub/Sub", "Presence DB"],
  },
  {
    id: 6,
    name: "VOD 스트리밍",
    domain: "HLS/DASH 주문형 미디어",
    difficulty: 6,
    protocols: ["HTTPS", "HLS", "DASH"],
    architectureLesson: "Transcoder → Segment Storage → CDN의 미디어 파이프라인",
    serverLogicLesson: "Manifest, Segment, Adaptive Bitrate, Range 처리",
    enemyDesign: ["Manifest", "영상 Segment", "Bitrate 전환", "Origin Miss"],
    equipmentDesign: ["Transcoder", "Segmenter", "Media Storage", "Media CDN"],
  },
  {
    id: 7,
    name: "라이브 방송",
    domain: "실시간 Ingest와 대규모 송출",
    difficulty: 7,
    protocols: ["RTMP", "SRT", "HLS", "HTTPS"],
    architectureLesson: "Ingest → Transcode → Package → Edge Delivery 이중 경로",
    serverLogicLesson: "지연 예산, 키프레임, 재연결, Live Manifest 갱신",
    enemyDesign: ["Live Ingest", "Packet Loss", "Transcode Job", "Viewer Surge"],
    equipmentDesign: ["Ingest Gateway", "Live Transcoder", "Packager", "Edge Cluster"],
  },
  {
    id: 8,
    name: "RTSP 관제 플랫폼",
    domain: "다채널 CCTV·실시간 미디어 게이트웨이",
    difficulty: 8,
    protocols: ["RTSP", "TCP", "HTTPS", "HLS"],
    architectureLesson: "RTSP Session, Media Relay, Recording, Web 변환 경로를 분리",
    serverLogicLesson: "DESCRIBE/SETUP/PLAY, RTP 세션, 채널 상태와 녹화 인덱스",
    enemyDesign: ["RTSP 제어", "RTP Media", "카메라 재접속", "다채널 동시 재생"],
    equipmentDesign: ["RTSP Gateway", "Media Relay", "Recorder", "Playback API"],
  },
] as const;

export const ACTIVE_STAGE = CAMPAIGN_STAGES[0];
