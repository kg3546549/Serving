import collections 
import collections.abc
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# 테마 색상 정의 (다크 모드 스타일)
DARK_BLUE = RGBColor(20, 34, 56)     # #142238 (배경)
WHITE = RGBColor(255, 255, 255)
LIGHT_BLUE = RGBColor(136, 184, 239) # #88B8EF (주요 포인트/강조)
LIGHT_GRAY = RGBColor(200, 200, 200)

def set_slide_background(slide, color):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_title(slide, text, top_inch=0.4, font_size=Pt(32), color=LIGHT_BLUE):
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(top_inch), Inches(9.0), Inches(0.8))
    tf = title_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = font_size
    p.font.bold = True
    p.font.color.rgb = color
    p.font.name = 'Malgun Gothic'
    return tf

def create_gdd_ppt():
    prs = Presentation()
    # 16:9 와이드 비율 설정
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(5.625)
    
    slide_layout = prs.slide_layouts[6] # Blank Layout
    
    # ----------------------------------------------------
    # Slide 1: Cover
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    
    txBox = slide.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(9.0), Inches(2.5))
    tf = txBox.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = "STACK//BREACH"
    p.font.size = Pt(54)
    p.font.bold = True
    p.font.color.rgb = LIGHT_BLUE
    p.font.name = 'Malgun Gothic'
    p.alignment = PP_ALIGN.CENTER
    
    p2 = tf.add_paragraph()
    p2.text = "서버 인프라 아키텍처 디펜스 게임 기획서"
    p2.font.size = Pt(22)
    p2.font.color.rgb = WHITE
    p2.font.name = 'Malgun Gothic'
    p2.alignment = PP_ALIGN.CENTER
    
    p3 = tf.add_paragraph()
    p3.text = "\n기말고사 프로젝트 제출 자료"
    p3.font.size = Pt(14)
    p3.font.color.rgb = LIGHT_GRAY
    p3.font.name = 'Malgun Gothic'
    p3.alignment = PP_ALIGN.CENTER

    # ----------------------------------------------------
    # Slide 2: 게임 소개
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    add_title(slide, "1. 게임 소개")
    
    body_box = slide.shapes.add_textbox(Inches(0.7), Inches(1.3), Inches(8.6), Inches(3.8))
    tf = body_box.text_frame
    tf.word_wrap = True
    
    items = [
        ("게임 장르", "서버 인프라 아키텍처 디펜스 / 퍼즐 시뮬레이터 (PC Web)"),
        ("타깃 유저", "소프트웨어 공학 및 네트워크 학습 중인 학생, 백엔드 개발 지망생"),
        ("핵심 재미", "실시간 서버/DB 병목 해결의 쾌감, 제한된 예산 안에서 최적 아키텍처 설계"),
        ("참고 게임", "Turing Complete (아키텍처 구성 퍼즐) + TFT/오토배틀러 (상점 및 합성)")
    ]
    for label, desc in items:
        p = tf.add_paragraph()
        p.text = f"■  {label}"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = LIGHT_BLUE
        p.font.name = 'Malgun Gothic'
        
        p_desc = tf.add_paragraph()
        p_desc.text = f"    - {desc}\n"
        p_desc.font.size = Pt(13)
        p_desc.font.color.rgb = WHITE
        p_desc.font.name = 'Malgun Gothic'

    # ----------------------------------------------------
    # Slide 3: 코어 루프
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    add_title(slide, "2. 코어 루프 (Core Loop)")
    
    body_box = slide.shapes.add_textbox(Inches(0.7), Inches(1.3), Inches(8.6), Inches(3.8))
    tf = body_box.text_frame
    tf.word_wrap = True
    
    loops = [
        ("1단계: 장비 구매 및 배치", "상점에서 인프라 장비(EC2, RDS 등)를 구매하고 보드에 기기를 가설/이동"),
        ("2단계: 링크 연결 및 서비스 개시", "장비 성격에 맞는 링크(트래픽/데이터) 연결 및 서비스 가동, 실시간 트래픽 유입"),
        ("3단계: 결과 획득 및 성장", "패킷 정상 처리 시 Credits 및 XP 획득, 플레이어 레벨업에 따른 보드/링크 용량 확장"),
        ("4단계: 반복 도전 및 리팩토링", "합성(2성/3성) 및 역할 증강을 활용하여 더 강력한 웨이브의 병목 패턴 방어")
    ]
    for step, desc in loops:
        p = tf.add_paragraph()
        p.text = f"●  {step}"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = LIGHT_BLUE
        p.font.name = 'Malgun Gothic'
        
        p_desc = tf.add_paragraph()
        p_desc.text = f"    {desc}\n"
        p_desc.font.size = Pt(13)
        p_desc.font.color.rgb = WHITE
        p_desc.font.name = 'Malgun Gothic'

    # ----------------------------------------------------
    # Slide 4: 세계관 및 배경 설정
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    add_title(slide, "3. 세계관 및 배경 설정")
    
    body_box = slide.shapes.add_textbox(Inches(0.7), Inches(1.3), Inches(8.6), Inches(3.8))
    tf = body_box.text_frame
    tf.word_wrap = True
    
    texts = [
        ("배경 및 콘셉트", "인프라 아키텍트가 되어 IT 기업의 실시간 백엔드 시스템 부하를 관리하는 모니터링 가상현실"),
        ("게임 톤앤무드", "짙은 프레임과 다크 블루 기반 테크니컬 디자인 + 입체적 글로우/파티클 패킷 연출로 지적 긴장감 조성"),
        ("플레이어 목표", "10개 웨이브 동안 실패 요청 비율을 억제하여 Service HP가 0이 되지 않도록 유지하며 최종 부하 테스트 통과"),
        ("시나리오 상황", "신규 서비스 오픈 직후 기하급수적으로 폭발하는 유저 트래픽 급증을 최소 예산으로 극복하는 실시간 서버 관리")
    ]
    for title, desc in texts:
        p = tf.add_paragraph()
        p.text = f"▶  {title}"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = LIGHT_BLUE
        p.font.name = 'Malgun Gothic'
        
        p_desc = tf.add_paragraph()
        p_desc.text = f"    {desc}\n"
        p_desc.font.size = Pt(13)
        p_desc.font.color.rgb = WHITE
        p_desc.font.name = 'Malgun Gothic'

    # ----------------------------------------------------
    # Slide 5: 캐릭터 소개
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    add_title(slide, "4. 캐릭터 소개 (트래픽 및 장비)")
    
    body_box = slide.shapes.add_textbox(Inches(0.7), Inches(1.3), Inches(8.6), Inches(3.8))
    tf = body_box.text_frame
    tf.word_wrap = True
    
    chars = [
        ("GET / POST 트래픽", "GET: DB 읽기 위주 병목 유발 / POST: DB 쓰기 위주 병목(Primary DB 성능 영향)"),
        ("SLOW / Burst 트래픽", "SLOW: 인덱스 부재 장시간 쿼리로 DB 큐 마비 / Burst: 단시간 대량 몰려와 서버 큐 폭발 유도"),
        ("아키텍트 (주인공)", "플레이어가 담당하며, 장비 포트 규칙(Ingress-Server-DB-Server-Egress)에 의거해 아키텍처 빌딩"),
        ("최종 보스 (Wave 10)", "GET, POST, SLOW, Burst가 복합적으로 몰려와 극한의 자원 최적화 한계를 시험하는 최종 부하 테스트")
    ]
    for char, desc in chars:
        p = tf.add_paragraph()
        p.text = f"👤  {char}"
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = LIGHT_BLUE
        p.font.name = 'Malgun Gothic'
        
        p_desc = tf.add_paragraph()
        p_desc.text = f"    {desc}\n"
        p_desc.font.size = Pt(12)
        p_desc.font.color.rgb = WHITE
        p_desc.font.name = 'Malgun Gothic'

    # ----------------------------------------------------
    # Slide 6: 디자인 가이드라인
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    add_title(slide, "5. 비주얼 컨셉 및 디자인 방향")
    
    body_box = slide.shapes.add_textbox(Inches(0.7), Inches(1.3), Inches(8.6), Inches(3.8))
    tf = body_box.text_frame
    tf.word_wrap = True
    
    visuals = [
        ("인터페이스 스타일", "Azure Portal 같은 딱딱한 웹보단 게임 HUD에 맞추어 짙은 프레임과 짧은 상태 표시 차용"),
        ("색상 가이드라인", "배경: #142238 (다크 블루) / 요청선: #88B8EF (파랑) / 응답선: #B4A1E5 (보라) / DB선: #F6D477 (노랑)"),
        ("Phaser VFX 연출", "장비 선택 시 펄스 효과, 배치 시 파티클 팝, 패킷 이동 시 Glow 및 Trail 입자 시각적 극대화"),
        ("컴포넌트 뷰", "텍스트 설명 대신 SVG 플랫 카드 아이콘을 주로 렌더링하고, 우클릭 시 세부 툴팁으로 정보 제공")
    ]
    for vis, desc in visuals:
        p = tf.add_paragraph()
        p.text = f"🎨  {vis}"
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = LIGHT_BLUE
        p.font.name = 'Malgun Gothic'
        
        p_desc = tf.add_paragraph()
        p_desc.text = f"    {desc}\n"
        p_desc.font.size = Pt(12)
        p_desc.font.color.rgb = WHITE
        p_desc.font.name = 'Malgun Gothic'

    prs.save("f:/dev/Serving/project_doc/기획서.pptx")

def create_dev_ppt():
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(5.625)
    
    slide_layout = prs.slide_layouts[6]
    
    # ----------------------------------------------------
    # Slide 1: Cover
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    
    txBox = slide.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(9.0), Inches(2.5))
    tf = txBox.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = "STACK//BREACH"
    p.font.size = Pt(54)
    p.font.bold = True
    p.font.color.rgb = LIGHT_BLUE
    p.font.name = 'Malgun Gothic'
    p.alignment = PP_ALIGN.CENTER
    
    p2 = tf.add_paragraph()
    p2.text = "서버 인프라 아키텍처 디펜스 게임 개발 계획서"
    p2.font.size = Pt(22)
    p2.font.color.rgb = WHITE
    p2.font.name = 'Malgun Gothic'
    p2.alignment = PP_ALIGN.CENTER
    
    p3 = tf.add_paragraph()
    p3.text = "\n기말고사 프로젝트 제출 자료"
    p3.font.size = Pt(14)
    p3.font.color.rgb = LIGHT_GRAY
    p3.font.name = 'Malgun Gothic'
    p3.alignment = PP_ALIGN.CENTER

    # ----------------------------------------------------
    # Slide 2: 개발 로드맵
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    add_title(slide, "1. 개발 로드맵 및 우선순위")
    
    body_box = slide.shapes.add_textbox(Inches(0.7), Inches(1.3), Inches(8.6), Inches(3.8))
    tf = body_box.text_frame
    tf.word_wrap = True
    
    roadmap = [
        ("1순위: 핵심 플레이 및 가설계 (단계 1 ~ 3)", "Phaser 격자 구축, React HUD/배치 시스템, 장비 간 연결선 및 Manhattan 검증"),
        ("2순위: 시스템 로직 고도화 (단계 4 ~ 5)", "시뮬레이션 실시간 루프 연출, 상점 가챠 확률 및 레벨업 확장, 오토배틀러 자동 합성/증강"),
        ("3순위: 디테일 업 및 폴리싱 (단계 6)", "Glow, Trail 등 VFX 시각 요소 고도화 및 효과음(오디오) 통합 리팩토링")
    ]
    for priority, desc in roadmap:
        p = tf.add_paragraph()
        p.text = f"📌  {priority}"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = LIGHT_BLUE
        p.font.name = 'Malgun Gothic'
        
        p_desc = tf.add_paragraph()
        p_desc.text = f"    - {desc}\n"
        p_desc.font.size = Pt(13)
        p_desc.font.color.rgb = WHITE
        p_desc.font.name = 'Malgun Gothic'

    # ----------------------------------------------------
    # Slide 3: 세부 계획 1
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    add_title(slide, "2. 단계별 세부 계획 (단계 1, 2)")
    
    body_box = slide.shapes.add_textbox(Inches(0.7), Inches(1.3), Inches(8.6), Inches(3.8))
    tf = body_box.text_frame
    tf.word_wrap = True
    
    steps12 = [
        ("단계 1: Phaser 3 격자 및 카메라", "구현: 가변 그리드(7x4~13x6) 타일링, 마우스 휠 줌, 빈 맵 스크롤, R키 원복\n완성 기준: 로컬 구동 시 맵 확대/축소 및 이동이 부드럽게 작동할 것"),
        ("단계 2: React HUD 및 노드 배치", "구현: Zustand 연동 경제/HP HUD, 상점 카드 ➡️ 보드 드래그 앤 드롭 스냅, 노드 이동\n완성 기준: 상점 장비 클릭 시 마우스 트래킹하여 보드 셀 중심에 정확히 안착")
    ]
    for step, desc in steps12:
        p = tf.add_paragraph()
        p.text = f"⚙️  {step}"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = LIGHT_BLUE
        p.font.name = 'Malgun Gothic'
        
        p_desc = tf.add_paragraph()
        p_desc.text = f"    {desc}\n"
        p_desc.font.size = Pt(12)
        p_desc.font.color.rgb = WHITE
        p_desc.font.name = 'Malgun Gothic'

    # ----------------------------------------------------
    # Slide 4: 세부 계획 2
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    add_title(slide, "2. 단계별 세부 계획 (단계 3, 4)")
    
    body_box = slide.shapes.add_textbox(Inches(0.7), Inches(1.3), Inches(8.6), Inches(3.8))
    tf = body_box.text_frame
    tf.word_wrap = True
    
    steps34 = [
        ("단계 3: 연결선(Link) 시스템", "구현: Shift/우클릭 드래그 노드 간 선 생성, 포트 규칙 예외 검사, Manhattan 제한 거리 검증\n완성 기준: 불허 경로 차단 및 한계 예산 초과 시 연결 취소 및 팝업 출력"),
        ("단계 4: 시뮬레이션 및 패킷 연출", "구현: 서비스 개시 버튼, 실시간 Tick 시뮬레이션 루프, 패킷 등속 이동 연출, 큐 부하 게이지바\n완성 기준: Ingress에서 출발한 패킷이 연결망을 따라 순차 이동 후 Egress 도달성 검증")
    ]
    for step, desc in steps34:
        p = tf.add_paragraph()
        p.text = f"⚙️  {step}"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = LIGHT_BLUE
        p.font.name = 'Malgun Gothic'
        
        p_desc = tf.add_paragraph()
        p_desc.text = f"    {desc}\n"
        p_desc.font.size = Pt(12)
        p_desc.font.color.rgb = WHITE
        p_desc.font.name = 'Malgun Gothic'

    # ----------------------------------------------------
    # Slide 5: 세부 계획 3 & DOD
    # ----------------------------------------------------
    slide = prs.slides.add_slide(slide_layout)
    set_slide_background(slide, DARK_BLUE)
    add_title(slide, "2. 단계별 세부 계획 (단계 5, DOD)")
    
    body_box = slide.shapes.add_textbox(Inches(0.7), Inches(1.3), Inches(8.6), Inches(3.8))
    tf = body_box.text_frame
    tf.word_wrap = True
    
    steps5 = [
        ("단계 5: 상점 리롤 및 합성/증강", "구현: Credits 지출 및 리롤, 동일 장비 3개 수집 시 자동 합성(2/3성), 합성 시 증강 팝업 및 스펙 갱신\n완성 기준: 3개 수집 즉시 병합음과 함께 별(★) 갱신 및 능력치 누적 적용"),
        ("완성 기준 (Definition of Done)", "테스트 기준: 핵심 알고리즘(거리 검증, 합성 로직 등)에 대한 Vitest 단위 테스트(npm test) 100% 통과\n구현 기준: 1280x720 브라우저 상에서 인터페이스 오버플로 없이 시나리오 100% 정상 가동")
    ]
    for step, desc in steps5:
        p = tf.add_paragraph()
        p.text = f"⚙️  {step}"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = LIGHT_BLUE
        p.font.name = 'Malgun Gothic'
        
        p_desc = tf.add_paragraph()
        p_desc.text = f"    {desc}\n"
        p_desc.font.size = Pt(12)
        p_desc.font.color.rgb = WHITE
        p_desc.font.name = 'Malgun Gothic'

    prs.save("f:/dev/Serving/project_doc/개발계획서.pptx")

if __name__ == '__main__':
    create_gdd_ppt()
    create_dev_ppt()
    print("PPT files generated successfully!")
