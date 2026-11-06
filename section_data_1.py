"""
Section Data Part 1:
- Title Page & Front Matter
- Executive Abstract & Project Metadata
- Table of Contents
- Section 1: Introduction
- Section 2: Problem Statement
- Section 3: Solution Architecture & Cryptographic Primitives
"""

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from journal_builder import (
    COLOR_PRIMARY, COLOR_SECONDARY, COLOR_ACCENT, COLOR_TEXT, COLOR_MUTED,
    HEX_PRIMARY, HEX_LIGHT_BG, HEX_CALLOUT_BG,
    add_heading_1, add_heading_2, add_heading_3, add_paragraph,
    add_callout_box, add_code_block, add_academic_table,
    set_cell_background, set_cell_margins
)

import os
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
from journal_builder import HEX_BORDER

def build_title_page(doc):
    """Constructs the formal academic title page according to the Bhavan's College format."""
    # Logo
    logo_path = os.path.join(os.path.dirname(__file__), 'docs', 'images', 'bhavans_logo.png')
    if os.path.exists(logo_path):
        p_logo = doc.add_paragraph()
        p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_logo.paragraph_format.space_before = Pt(4)
        p_logo.paragraph_format.space_after = Pt(4)
        p_logo.paragraph_format.line_spacing = 1.0
        r_logo = p_logo.add_run()
        r_logo.add_picture(logo_path, width=Inches(1.15))

    # Institution Name
    p_inst1 = doc.add_paragraph()
    p_inst1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst1.paragraph_format.space_before = Pt(2)
    p_inst1.paragraph_format.space_after = Pt(1)
    p_inst1.paragraph_format.line_spacing = 1.0
    r1 = p_inst1.add_run("B H A R A T I Y A   V I D Y A   B H A V A N ' S")
    r1.font.name = 'Times New Roman'
    r1.font.size = Pt(10.5)
    r1.font.bold = True
    r1.font.color.rgb = COLOR_PRIMARY

    p_inst2 = doc.add_paragraph()
    p_inst2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst2.paragraph_format.space_before = Pt(0)
    p_inst2.paragraph_format.space_after = Pt(1)
    p_inst2.paragraph_format.line_spacing = 1.0
    r2 = p_inst2.add_run("M. M. College Of Arts, N. M. Institute Of Science, H. R. J. College Of Commerce")
    r2.font.name = 'Times New Roman'
    r2.font.size = Pt(9.5)
    r2.font.bold = True
    r2.font.color.rgb = COLOR_SECONDARY

    p_inst3 = doc.add_paragraph()
    p_inst3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst3.paragraph_format.space_before = Pt(0)
    p_inst3.paragraph_format.space_after = Pt(1)
    p_inst3.paragraph_format.line_spacing = 1.0
    r3 = p_inst3.add_run("Bhavan's College")
    r3.font.name = 'Times New Roman'
    r3.font.size = Pt(12)
    r3.font.bold = True
    r3.font.color.rgb = COLOR_PRIMARY

    p_inst4 = doc.add_paragraph()
    p_inst4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst4.paragraph_format.space_before = Pt(0)
    p_inst4.paragraph_format.space_after = Pt(8)
    p_inst4.paragraph_format.line_spacing = 1.0
    r4 = p_inst4.add_run(
        "(Empowered Autonomous 2026-36) · (Autonomous 2020-30)\n"
        "Established in 1946 | Re-accredited \"A\" Grade by NAAC\n"
        "Munshi Nagar, Andheri (W), Mumbai - 400058"
    )
    r4.font.name = 'Times New Roman'
    r4.font.size = Pt(8)
    r4.font.color.rgb = COLOR_MUTED

    # Assessment Banner
    p_cia = doc.add_paragraph()
    p_cia.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cia.paragraph_format.space_before = Pt(4)
    p_cia.paragraph_format.space_after = Pt(4)
    p_cia.paragraph_format.line_spacing = 1.0
    r_cia = p_cia.add_run("MINI PROJECT · C I A - 2")
    r_cia.font.name = 'Times New Roman'
    r_cia.font.size = Pt(12)
    r_cia.font.bold = True
    r_cia.font.color.rgb = COLOR_SECONDARY

    # Project Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(4)
    p_title.paragraph_format.space_after = Pt(1)
    p_title.paragraph_format.line_spacing = 1.0
    r_title = p_title.add_run("ZEROVAULT")
    r_title.font.name = 'Times New Roman'
    r_title.font.size = Pt(16)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(8)
    p_sub.paragraph_format.line_spacing = 1.0
    r_sub = p_sub.add_run("Trustless Blockchain Escrow & Cryptographic Partial Disclosure Protocol")
    r_sub.font.name = 'Times New Roman'
    r_sub.font.size = Pt(10)
    r_sub.font.italic = True
    r_sub.font.color.rgb = COLOR_MUTED

    # Course Details Table
    course_table = doc.add_table(rows=4, cols=2)
    course_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    course_table.autofit = False
    
    course_rows = [
        ("Course Title", "Blockchain Technology"),
        ("Course Code", "BH.USCS.Maj503"),
        ("Programme", "B.Sc. Computer Science (T.Y.C.S.)"),
        ("Academic Year", "2026-27")
    ]
    
    for idx, (label, val) in enumerate(course_rows):
        c1, c2 = course_table.rows[idx].cells
        c1.width = Inches(2.2)
        c2.width = Inches(3.6)
        set_cell_background(c1, HEX_LIGHT_BG)
        set_cell_background(c2, "FFFFFF")
        set_cell_margins(c1, top=40, bottom=40, left=100, right=100)
        set_cell_margins(c2, top=40, bottom=40, left=100, right=100)
        
        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_before = Pt(1)
        p1.paragraph_format.space_after = Pt(1)
        p1.paragraph_format.line_spacing = 1.0
        r1 = p1.add_run(label)
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(9)
        r1.font.bold = True
        r1.font.color.rgb = COLOR_PRIMARY
        
        p2 = c2.paragraphs[0]
        p2.paragraph_format.space_before = Pt(1)
        p2.paragraph_format.space_after = Pt(1)
        p2.paragraph_format.line_spacing = 1.0
        r2 = p2.add_run(val)
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(9)
        r2.font.color.rgb = COLOR_TEXT
        
        for c in (c1, c2):
            tcPr = c._tc.get_or_add_tcPr()
            tcBorders = parse_xml(
                f'<w:tcBorders {nsdecls("w")}>'
                f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
                f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
                f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
                f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
                f'</w:tcBorders>'
            )
            tcPr.append(tcBorders)

    # SUBMITTED BY Header
    p_subby = doc.add_paragraph()
    p_subby.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_subby.paragraph_format.space_before = Pt(8)
    p_subby.paragraph_format.space_after = Pt(4)
    p_subby.paragraph_format.line_spacing = 1.0
    r_subby = p_subby.add_run("S U B M I T T E D   B Y")
    r_subby.font.name = 'Times New Roman'
    r_subby.font.size = Pt(10)
    r_subby.font.bold = True
    r_subby.font.color.rgb = COLOR_PRIMARY

    # Group Members Table
    group_table = doc.add_table(rows=6, cols=2)
    group_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    group_table.autofit = False
    
    group_rows = [
        ("TYCS37", "Soham Pawar"),
        ("TYCS36", "Suryaprakash Pati"),
        ("TYCS22", "Gaurav Kanojiya"),
        ("TYCS28", "Madhur Kushwaha"),
        ("TYCS63", "Georgina Varghese")
    ]
    
    # Header row
    h1, h2 = group_table.rows[0].cells
    h1.width = Inches(2.2)
    h2.width = Inches(3.6)
    set_cell_background(h1, HEX_PRIMARY)
    set_cell_background(h2, HEX_PRIMARY)
    set_cell_margins(h1, top=50, bottom=50, left=100, right=100)
    set_cell_margins(h2, top=50, bottom=50, left=100, right=100)
    
    ph1 = h1.paragraphs[0]
    ph1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ph1.paragraph_format.space_before = Pt(1)
    ph1.paragraph_format.space_after = Pt(1)
    rh1 = ph1.add_run("Roll No.")
    rh1.font.name = 'Times New Roman'
    rh1.font.size = Pt(9)
    rh1.font.bold = True
    rh1.font.color.rgb = RGBColor(255, 255, 255)
    
    ph2 = h2.paragraphs[0]
    ph2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ph2.paragraph_format.space_before = Pt(1)
    ph2.paragraph_format.space_after = Pt(1)
    rh2 = ph2.add_run("Name of Group Member")
    rh2.font.name = 'Times New Roman'
    rh2.font.size = Pt(9)
    rh2.font.bold = True
    rh2.font.color.rgb = RGBColor(255, 255, 255)
    
    for c in (h1, h2):
        tcPr = c._tc.get_or_add_tcPr()
        tcBorders = parse_xml(
            f'<w:tcBorders {nsdecls("w")}>'
            f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
            f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
            f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
            f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
            f'</w:tcBorders>'
        )
        tcPr.append(tcBorders)

    for idx, (roll, name) in enumerate(group_rows):
        c1, c2 = group_table.rows[idx + 1].cells
        c1.width = Inches(2.2)
        c2.width = Inches(3.6)
        bg_color = HEX_LIGHT_BG if idx % 2 == 1 else "FFFFFF"
        set_cell_background(c1, bg_color)
        set_cell_background(c2, bg_color)
        set_cell_margins(c1, top=35, bottom=35, left=100, right=100)
        set_cell_margins(c2, top=35, bottom=35, left=100, right=100)
        
        p1 = c1.paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p1.paragraph_format.space_before = Pt(1)
        p1.paragraph_format.space_after = Pt(1)
        p1.paragraph_format.line_spacing = 1.0
        r1 = p1.add_run(roll)
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(8.5)
        r1.font.color.rgb = COLOR_TEXT
        
        p2 = c2.paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p2.paragraph_format.space_before = Pt(1)
        p2.paragraph_format.space_after = Pt(1)
        p2.paragraph_format.line_spacing = 1.0
        r2 = p2.add_run(name)
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(8.5)
        r2.font.color.rgb = COLOR_TEXT
        
        for c in (c1, c2):
            tcPr = c._tc.get_or_add_tcPr()
            tcBorders = parse_xml(
                f'<w:tcBorders {nsdecls("w")}>'
                f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
                f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
                f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
                f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
                f'</w:tcBorders>'
            )
            tcPr.append(tcBorders)

    # Guidance Section
    p_guide1 = doc.add_paragraph()
    p_guide1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_guide1.paragraph_format.space_before = Pt(8)
    p_guide1.paragraph_format.space_after = Pt(1)
    p_guide1.paragraph_format.line_spacing = 1.0
    r_g1 = p_guide1.add_run("Under the guidance of")
    r_g1.font.name = 'Times New Roman'
    r_g1.font.size = Pt(9.5)
    r_g1.font.italic = True
    r_g1.font.color.rgb = COLOR_MUTED

    p_guide2 = doc.add_paragraph()
    p_guide2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_guide2.paragraph_format.space_before = Pt(0)
    p_guide2.paragraph_format.space_after = Pt(0)
    p_guide2.paragraph_format.line_spacing = 1.0
    r_g2 = p_guide2.add_run("Shamaila Baloch Ma'am")
    r_g2.font.name = 'Times New Roman'
    r_g2.font.size = Pt(11)
    r_g2.font.bold = True
    r_g2.font.color.rgb = COLOR_PRIMARY

def build_abstract_and_toc(doc):
    """Renders Executive Abstract, Keywords, and Table of Contents."""
    doc.add_page_break()
    
    # Title of Abstract
    p_abs_title = doc.add_paragraph()
    p_abs_title.paragraph_format.space_before = Pt(16)
    p_abs_title.paragraph_format.space_after = Pt(8)
    p_abs_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_abs = p_abs_title.add_run("EXECUTIVE ABSTRACT")
    r_abs.font.name = 'Times New Roman'
    r_abs.font.size = Pt(15)
    r_abs.font.bold = True
    r_abs.font.color.rgb = COLOR_PRIMARY

    add_paragraph(
        doc,
        "The acquisition and disclosure of previously undisclosed software vulnerabilities (commonly designated as 'zero-day' exploits) "
        "presents one of the most severe structural market failures in modern information security. In a bilateral, untrusted zero-day "
        "transaction between an independent security researcher and an affected software vendor or institutional defender, both parties "
        "confront a fundamental information asymmetry known in economic theory as the 'Market for Lemons' and the 'Hold-Up Problem.' "
        "The prospective buyer cannot verify the authentic utility, scope, or severity of the vulnerability without inspecting its functional "
        "proof-of-concept (PoC); conversely, the researcher cannot disclose the technical PoC prior to payment without surrendering all "
        "intellectual and economic leverage, thereby exposing themselves to uncompensated exploitation, counterparty repudiation, or "
        "retaliatory legal coercion. Contemporary remedies—ranging from centralized bug bounty platforms to opaque private defense brokerages "
        "and illicit darknet forums—suffer from prohibitive brokerage fees (often exceeding 25–33%), subjective human arbitration, existential "
        "leakage risks via centralized server honeypots, and extreme settlement latency spanning weeks or months."
    )
    
    add_paragraph(
        doc,
        "To decisively overcome these foundational economic and cryptographic dilemmas, this research introduces ZeroVault: a trustless, "
        "non-custodial blockchain escrow and cryptographic partial disclosure protocol engineered specifically for zero-day vulnerability exchange. "
        "ZeroVault couples off-chain symmetric encryption (AES-256-GCM) and cryptographic commitment schemes with an on-chain Ethereum smart "
        "contract state machine deployed on the Ethereum Sepolia testnet and local Hardhat environments. Before initiating negotiations, "
        "the security researcher segments the structured metadata of the vulnerability (e.g., CVSS metrics, target component, impact vector, "
        "prerequisites) into cryptographic leaf claims, constructs a deterministic Merkle Tree via Keccak-256, and submits the Merkle Root and "
        "the hash of the symmetric decryption key to the ZeroVault smart contract. The researcher selectively reveals discrete leaves accompanied "
        "by cryptographically unforgeable Merkle inclusion proofs, enabling the buyer to mathematically authenticate the seller's claims in "
        "client-side browser runtime prior to locking capital. Once satisfied, the buyer deposits native ETH into the escrow contract. Settlement "
        "is executed atomically through a single smart contract transaction: upon submission of the valid preimage decryption key, the contract "
        "verifies the key hash on-chain, immediately transfers the locked bounty to the researcher, and emits the cryptographic key hash event, "
        "eliminating subjective dispute mediation windows, trusted third-party custodians, and counterparty escrow lockup risks."
    )

    add_paragraph(
        doc,
        "ZeroVault encompasses an end-to-end, full-stack implementation comprising an audited Solidity smart contract (enforcing Checks-Effects-Interactions, "
        "OpenZeppelin ReentrancyGuard, and AccessControl), an Express.js/Node.js API gateway equipped with in-memory sliding-window rate limiting and Sign-In "
        "with Ethereum (SIWE, EIP-4361) cryptographic authentication, a client-side Next.js 14 Web3 application, and local encrypted filesystem storage "
        "architected behind an IPFS-compatible interface. Rigorous empirical verification was conducted across three distinct security audit passes, 26 out of "
        "26 passing automated Playwright CLI end-to-end browser specifications, comprehensive Hardhat smart contract unit test suites covering reentrancy attack "
        "simulations and time-manipulated timeout invariants, and live contract verification on the Ethereum Sepolia testnet. All architectural MVP simplifications "
        "(local storage abstraction, in-memory rate limiting, SIWE-only authentication, single 24-hour session tokens, parameterized constructor timeouts, and "
        "single-admin testnet governance) represent deliberate, documented engineering scope boundaries designed to maximize auditability and zero-day "
        "confidentiality. This journal provides a comprehensive technical autopsy of the protocol, its theoretical foundations, implementation mechanics, "
        "and empirical validation."
    )

    p_kw = doc.add_paragraph()
    p_kw.paragraph_format.space_before = Pt(8)
    p_kw.paragraph_format.space_after = Pt(20)
    r_kwh = p_kw.add_run("Keywords: ")
    r_kwh.font.name = 'Times New Roman'
    r_kwh.font.size = Pt(10)
    r_kwh.font.bold = True
    r_kwh.font.color.rgb = COLOR_PRIMARY
    
    r_kwt = p_kw.add_run(
        "Zero-Day Vulnerabilities, Trustless Escrow, Smart Contracts, Merkle Tree Inclusion Proofs, "
        "Cryptographic Partial Disclosure, Sign-In with Ethereum (SIWE), Atomic Settlement, Information Asymmetry, "
        "Ethereum Sepolia, Checks-Effects-Interactions."
    )
    r_kwt.font.name = 'Times New Roman'
    r_kwt.font.size = Pt(10)
    r_kwt.font.italic = True
    r_kwt.font.color.rgb = COLOR_TEXT

    # Table of Contents
    p_toc_title = doc.add_paragraph()
    p_toc_title.paragraph_format.space_before = Pt(18)
    p_toc_title.paragraph_format.space_after = Pt(8)
    p_toc_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_toc = p_toc_title.add_run("TABLE OF CONTENTS")
    r_toc.font.name = 'Times New Roman'
    r_toc.font.size = Pt(15)
    r_toc.font.bold = True
    r_toc.font.color.rgb = COLOR_PRIMARY

    toc_headers = ["Section", "Title / Content Description", "Page No."]
    toc_rows = [
        ("1.0", "Introduction & Domain Background", "6"),
        ("  1.1", "Cyber Threat Intelligence & Vulnerability Coordination Lifecycle", "6"),
        ("  1.2", "The Economic Landscape: White-Hat, Gray-Hat, and Black-Hat Markets", "6"),
        ("  1.3", "The Information Asymmetry Paradox in Zero-Day Procurement", "7"),
        ("  1.4", "Project Objectives and Core Research Questions", "7"),
        ("  1.5", "Justification for Public Blockchain Technology Over Centralized APIs", "8"),
        ("2.0", "Problem Statement", "8"),
        ("  2.1", "The Vulnerability Seller's Dilemma & The Hold-Up Problem", "8"),
        ("  2.2", "The Vulnerability Buyer's Dilemma & Ghost Bounty Risks", "9"),
        ("  2.3", "Structural Failure Modes of Centralized Escrows & Human Arbitration", "9"),
        ("  2.4", "Attack Vectors, Griefing, and Surveillance in Vulnerability Exchange", "10"),
        ("  2.5", "Formal Mathematical Formulation of the Bilateral Verification Paradox", "10"),
        ("3.0", "Solution Architecture & Cryptographic Foundations", "11"),
        ("  3.1", "The ZeroVault Protocol Philosophy & Security Model", "11"),
        ("  3.2", "Dual-Stage Cryptographic Pre-Commitment Scheme", "12"),
        ("  3.3", "Merkle Tree Partial Disclosure & Client-Side Proof Verification", "12"),
        ("  3.4", "Atomic Single-Transaction Settlement Mechanism", "13"),
        ("  3.5", "Formal Mathematical Security Invariants & Proof Sketches", "14"),
        ("4.0", "System Architecture & Design", "15"),
        ("  4.1", "Global System Architecture Overview & Component Layering", "15"),
        ("  4.2", "End-to-End System Data Flow Architecture", "15"),
        ("  4.3", "Merkle Tree Structure & Claim Decomposition", "16"),
        ("  4.4", "Network Topology, Node Infrastructure & Testnet Layout", "16"),
        ("  4.5", "Smart Contract Finite State Machine", "17"),
        ("  4.6", "Relational Database Schema & Off-Chain Cache Reconciliation", "17"),
        ("5.0", "Existing System vs. Proposed System", "19"),
        ("  5.1", "Analysis of Contemporary Vulnerability Acquisition Paradigms", "19"),
        ("  5.2", "Traditional Bug Bounty Platforms (HackerOne, Bugcrowd)", "19"),
        ("  5.3", "Specialized Private Defense Brokers (Zerodium, Crowdfense)", "19"),
        ("  5.4", "Underground Darknet Forums & Over-The-Counter Channels", "19"),
        ("  5.5", "Multi-Dimensional Comprehensive Comparative Evaluation Table", "19"),
        ("6.0", "Implementation Details", "21"),
        ("  6.1", "Smart Contract Implementation (ZeroVault.sol)", "21"),
        ("  6.2", "Consensus, Verification & Economic Incentive Game Dynamics", "21"),
        ("  6.3", "Cryptographic Subsystems: AES-256-GCM & Keccak-256 Merkle Engine", "22"),
        ("  6.4", "Full-Stack Software Architecture: Express Gateway, Next.js 14, Viem", "22"),
        ("7.0", "Testing, Audits & Empirical Results", "23"),
        ("  7.1", "The Three Formal Security Audit Passes & Evolution of Contract Logic", "23"),
        ("  7.2", "Smart Contract Hardhat Automated Test Suite & Reentrancy Attacker", "23"),
        ("  7.3", "End-to-End Browser Automation via Playwright CLI (26/26 Passing Tests)", "24"),
        ("  7.4", "Postman API Integration Test Suite & Automated Collection Runner", "25"),
        ("  7.5", "Ethereum Sepolia Live Testnet Deployment & Etherscan Verification", "26"),
        ("  7.6", "Client-Side UI Cryptographic Verification Testing", "27"),
        ("  7.7", "Administrative KYC and Role Governance Verification", "28"),
        ("8.0", "Applications, Known Limitations & Future Scope", "30"),
        ("  8.1", "Real-World Industrial, National Defense & Web3 Applications", "30"),
        ("  8.2", "Consolidated Known Limitations & V1 MVP Scope Decisions (Ground Truth)", "30"),
        ("  8.3", "Long-Term Technical Scaling Roadmap & Layer-2 Migration", "32"),
        ("9.0", "Conclusion", "33"),
        ("10.0", "Academic References", "34"),
        ("11.0", "Appendix A — Smart Contract Source Code (ZeroVault.sol)", "36"),
        ("12.0", "Appendix B — Backend API Gateway & Cryptographic Engine", "40"),
        ("13.0", "Appendix C — Test Suite Execution Logs & Deployment Receipts", "43")
    ]
    add_academic_table(doc, toc_headers, toc_rows, col_widths=[0.8, 5.0, 0.7])

def build_section_1(doc):
    """Section 1: Introduction."""
    add_heading_1(doc, "1.0 INTRODUCTION & DOMAIN BACKGROUND")
    
    add_heading_2(doc, "1.1 Cyber Threat Intelligence & Vulnerability Coordination Lifecycle")
    add_paragraph(
        doc,
        "In the contemporary geopolitical and digital landscape, computer software underpins critical societal infrastructure, including "
        "financial clearinghouses, electrical power distribution grids, telecommunications backbones, healthcare records systems, and autonomous "
        "military apparatus. Within this ubiquitously interconnected digital domain, software vulnerabilities represent acute existential risks. "
        "A 'zero-day' vulnerability denotes a software security defect that is known to an external entity—such as an independent researcher, a criminal "
        "syndicate, or a foreign intelligence agency—while remaining completely unknown to the vendor responsible for engineering and maintaining the "
        "affected codebase. Consequently, exactly zero days have elapsed since the developers became aware of the flaw, leaving zero patches, "
        "signatures, or defenses available to shield vulnerable deployments."
    )
    add_paragraph(
        doc,
        "The life cycle of a zero-day vulnerability begins with initial discovery during reverse engineering, source code auditing, or automated "
        "fuzz testing. Once an exploitable memory corruption, logic bypass, or cryptographic weakness is isolated, the security researcher constructs "
        "a reliable Proof-of-Concept (PoC) exploit demonstrating weaponized impact. At this critical juncture, the discoverer faces a pivotal "
        "coordination decision: whether to disclose the vulnerability responsibly to the vendor, monetize the intellectual property through legal "
        "bug bounty programs, sell the capability to institutional security brokers, or trade the exploit within unregulated gray or black markets. "
        "The economic frictions governing this decision dictate whether critical software flaws are remediated before mass exploitation or weaponized "
        "covertly against unsuspecting infrastructure."
    )

    add_heading_2(doc, "1.2 The Economic Landscape: White-Hat, Gray-Hat, and Black-Hat Markets")
    add_paragraph(
        doc,
        "The international vulnerability trade is economically bifurcated into three broad markets with wildly divergent incentive structures and legal statuses:",
        bold_prefix="Market Categorization: "
    )
    add_paragraph(
        doc,
        "1. White-Hat Coordinated Disclosure Markets: Comprising formal vendor-operated vulnerability reward programs (VRPs) and platform intermediaries "
        "(such as HackerOne and Bugcrowd). While legally sanctioned and aligned with defensive remediation, these programs typically offer modest financial "
        "compensation ($1,000 to $50,000 for critical enterprise software), impose restrictive non-disclosure agreements, and frequently suffer from vendor "
        "triage delays spanning multiple months, during which researchers possess zero legal guarantees of payment."
    )
    add_paragraph(
        doc,
        "2. Gray-Hat Institutional Markets: Dominated by specialized private defense contractors and brokerages (e.g., Zerodium, Crowdfense, and Operation Zero) "
        "supplying government intelligence agencies, sovereign defense departments, and law enforcement. These entities offer premium bounties reaching "
        "$500,000 to $5,000,000 for zero-click remote code execution (RCE) chains affecting mobile operating systems and enterprise servers. However, transactions "
        "are strictly bilateral, entirely opaque, mediated by non-negotiable legal contracts, and subject to arbitrary acceptance or rejection by the broker."
    )
    add_paragraph(
        doc,
        "3. Black-Hat Illicit Underground Markets: Operating via Tor-hidden services, Russian-language darknet crime forums (e.g., Exploit.in, XSS.is), "
        "and peer-to-peer encrypted messaging channels. Exploit payloads are traded for cryptocurrency (Bitcoin, Monero) to fuel cybercrime operations, ransomware "
        "campaigns, and state-sponsored espionage. While yielding rapid financial liquidity, participants operate in an adversarial wasteland characterized by "
        "ubiquitous exit scams, law enforcement honeypots, counterfeit exploits, and violent counterparty risks."
    )

    add_heading_2(doc, "1.3 The Information Asymmetry Paradox in Zero-Day Procurement")
    add_paragraph(
        doc,
        "At the core of all bilateral zero-day transactions lies an intractable economic paradox first formalized by Nobel laureate George Akerlof in his "
        "seminal 1970 work, 'The Market for Lemons: Quality Uncertainty and the Market Mechanism.' In any bilateral market characterized by asymmetric "
        "information, the seller possesses private knowledge regarding the authentic quality of the good, whereas the buyer cannot observe quality prior to "
        "purchase. In the specific context of zero-day exploits, this information asymmetry reaches an absolute extreme:"
    )
    add_paragraph(
        doc,
        "• The Buyer's Verification Requirement: A rational buyer (whether a software vendor purchasing an exploit to construct a patch or an institutional "
        "defender acquiring intelligence) cannot commit hundreds of thousands of dollars without rigorous proof that the vulnerability genuinely exists, "
        "targets the designated software version, operates reliably under modern exploit mitigations (ASLR, DEP, CFI), and provides the claimed execution privileges.",
        italic=True
    )
    add_paragraph(
        doc,
        "• The Seller's Leverage Requirement: A rational researcher cannot disclose the technical exploit payload, vulnerable function names, or execution "
        "mechanisms prior to payment. The instant technical details are surrendered, the buyer has received the good in full. The buyer can immediately "
        "remediate the vulnerability internally, deploy defensive signatures, or incorporate the PoC into offensive arsenals while refusing to compensate "
        "the researcher, who now retains zero commercial or legal leverage.",
        italic=True
    )
    add_paragraph(
        doc,
        "This dynamic generates a classical 'Hold-Up Problem.' Without a mechanism permitting verifiable proof of validity without substantive information leakage, "
        "honest buyers assume that unverified listings are defective ('lemons'), driving clearing prices below research costs and causing defensive markets to collapse."
    )

    add_heading_2(doc, "1.4 Project Objectives and Core Research Questions")
    add_paragraph(
        doc,
        "The overarching objective of the ZeroVault research initiative is to design, implement, audit, and evaluate a fully autonomous, trustless Web3 protocol "
        "that eliminates counterparty risk in zero-day transactions through cryptographic commitments and public smart contract execution. Specifically, this "
        "research addresses five primary technical questions:"
    )
    add_paragraph(
        doc,
        "1. Can a security researcher cryptographically commit to an exploit payload and prove discrete structural attributes (e.g., CVSS severity, affected "
        "binary component, attack complexity) without revealing the underlying actionable vulnerability mechanics?"
    )
    add_paragraph(
        doc,
        "2. How can an on-chain smart contract atomically synchronize the disclosure of a symmetric decryption key with the irrevocable disbursement of funds, "
        "preventing both buyer non-payment and seller ghost delivery?"
    )
    add_paragraph(
        doc,
        "3. Is it possible to completely eliminate human dispute arbitrators and subjective dispute windows from vulnerability escrows while maintaining absolute "
        "security against rogue counterparties?"
    )
    add_paragraph(
        doc,
        "4. How can decentralized identity standards (Sign-In with Ethereum, EIP-4361) and role-based access control reconcile pseudonymous researcher operations "
        "with enterprise KYC compliance requirements?"
    )
    add_paragraph(
        doc,
        "5. What are the formal economic and cryptographic guarantees governing dual-timeout recovery mechanisms (dead man's switch vs. buyer reclaim window)?"
    )

    add_heading_2(doc, "1.5 Justification for Public Blockchain Technology Over Centralized APIs")
    add_paragraph(
        doc,
        "A critical foundational question in software engineering is whether a given problem warrants the overhead, latency, and economic gas expenditure of "
        "a blockchain or whether a centralized database (e.g., PostgreSQL with a trusted Stripe/PayPal escrow API) would suffice. For the ZeroVault zero-day "
        "procurement protocol, public blockchain infrastructure is strictly and provably necessary due to the following non-negotiable requirements:"
    )
    add_paragraph(
        doc,
        "• Elimination of Trusted Custodians: In a centralized escrow architecture, a corporate entity holds custody of the escrowed funds and mediates disputes. "
        "In zero-day transactions, trusting a centralized custodian is unacceptable. If the custodian is compromised, subpoenaed by hostile nation-states, or "
        "financially corrupt, escrowed funds can be seized and sensitive zero-day exploits exfiltrated. A decentralized smart contract guarantees that funds are "
        "custodied solely by immutable EVM code.",
        bold_prefix="1. Non-Custodial Neutrality: "
    )
    add_paragraph(
        doc,
        "• Programmatic Settlement Atomicity: In traditional banking and centralized web APIs, transactions are decoupled across asynchronous database writes, "
        "webhooks, and third-party settlement networks (Fedwire, ACH, SWIFT). If a server crashes mid-flight, a seller might reveal an exploit key without receiving "
        "wire confirmation. On the Ethereum blockchain, execution is strictly atomic within a single EVM state transition: either the key hash verifies and the "
        "ETH balance transfers in the exact same transaction, or the entire state reverts with zero side effects.",
        bold_prefix="2. Cryptographic Atomicity: "
    )
    add_paragraph(
        doc,
        "• Tamper-Proof Audit Trail & Event Transparency: Smart contract events (`VulnerabilityCommitted`, `BountyLocked`, `SettlementConfirmed`) are permanently "
        "inscribed into immutable Merkle-Patricia tries on the public ledger. Neither a rogue server administrator nor a coercive state actor can alter transaction "
        "timestamps, overwrite Merkle roots, or falsify proof records retroactively.",
        bold_prefix="3. Censorship Resistance: "
    )

def build_section_2(doc):
    """Section 2: Problem Statement."""
    add_heading_1(doc, "2.0 PROBLEM STATEMENT")
    
    add_heading_2(doc, "2.1 The Vulnerability Seller's Dilemma & The Hold-Up Problem")
    add_paragraph(
        doc,
        "The fundamental vulnerability seller's dilemma stems from the non-rival, highly perishable nature of zero-day vulnerability intelligence. "
        "Engineering a functional zero-day exploit requires hundreds of hours of painstaking manual static analysis, binary disassembly, heap layout grooming, "
        "and mitigation bypass crafting (e.g., circumventing Control Flow Guard, Pointer Authentication, and Hardware-enforced Stack Protection). "
        "The economic value of this asset is entirely contingent upon its secrecy."
    )
    add_paragraph(
        doc,
        "Under contemporary bilateral negotiation models, when an independent researcher approaches a vendor or defense contractor, the researcher is asked to "
        "provide technical verification. The moment the researcher shares technical details—such as the vulnerable function name, memory corruption primitive, "
        "or crash dump—the researcher enters the classical 'Hold-Up Problem.' The buyer possesses all the necessary technical information to locate the vulnerability "
        "internally, develop a software patch, and push it to production. The buyer can then claim that the bug was 'already known internally' (a rampant practice "
        "colloquially referred to as 'ghost-duping' in the bug bounty ecosystem) or simply refuse to negotiate further. The researcher has expended substantial capital "
        "and time, only to be left entirely uncompensated with zero legal recourse due to the jurisdictional and legal ambiguities surrounding reverse engineering."
    )

    add_heading_2(doc, "2.2 The Vulnerability Buyer's Dilemma & Ghost Bounty Risks")
    add_paragraph(
        doc,
        "Conversely, the buyer confronts an equally devastating counterparty hazard. In software security, superficial claims of vulnerability are trivially easy "
        "to fabricate. An anonymous seller can assert possession of an unauthenticated remote code execution exploit targeting the core network daemon of an enterprise "
        "operating system. If the buyer pays funds upfront into an unregulated escrow or directly to the seller, the buyer risks receiving:"
    )
    add_paragraph(
        doc,
        "• Defective or Non-Functional Payloads: Exploits that trigger an unexploitable denial-of-service crash rather than arbitrary code execution, or exploits "
        "that fail completely across standard target configurations.",
        italic=True
    )
    add_paragraph(
        doc,
        "• Outdated or Public CVEs: Re-packaged public vulnerabilities that have already been patched in mainstream distribution channels.",
        italic=True
    )
    add_paragraph(
        doc,
        "• Outright Fraud ('Ghost Bounties'): Encrypted files containing pseudorandom garbage bytes where the seller vanishes immediately after capturing the bounty.",
        italic=True
    )
    add_paragraph(
        doc,
        "Because buyers are institutional organizations with legal reputations, participating in unverified transactions exposes them to severe financial "
        "and operational damage without any cryptographic assurance that the acquired asset matches contractual specifications."
    )

    add_heading_2(doc, "2.3 Structural Failure Modes of Centralized Escrows & Human Arbitration")
    add_paragraph(
        doc,
        "To mitigate bilateral counterparty risk, traditional commerce relies on trusted human escrow intermediaries. However, when applied to zero-day vulnerabilities, "
        "centralized human arbitration introduces catastrophic failure modes:",
        bold_prefix="Arbitration Failure Modes: "
    )
    add_paragraph(
        doc,
        "1. Massive Brokerage Rents: Commercial brokers and intermediaries charge exorbitant commission cuts, frequently retaining 20% to 35% of the total transaction "
        "value, disincentivizing top-tier security talent from participating in coordinated defense."
    )
    add_paragraph(
        doc,
        "2. Catastrophic Central Honeypot Risk: Centralized escrow platforms must store copies of the technical reports and proof-of-concept exploits on centralized cloud "
        "servers during review. This creates an irresistible target for advanced persistent threats (APTs) and cybercriminals. A single breach of a broker's server "
        "compromises dozens of unpatched zero-day weapons affecting global software infrastructure."
    )
    add_paragraph(
        doc,
        "3. The Subjective Arbitration Paradox: If a dispute arises between buyer and seller regarding exploit reliability, human arbitrators lack the technical expertise "
        "or neutral testing environments to verify weaponized binary exploits without executing them. Executing an unvetted zero-day in a laboratory risks sandboxed "
        "escape and malware infection. Furthermore, subjective human mediators can be bribed, coerced, or biased toward repeat enterprise clients over transient "
        "individual researchers."
    )
    add_paragraph(
        doc,
        "4. Indefinite Escrow Capital Lockup: Centralized dispute resolution processes routinely drag on for 30 to 90 days, locking up substantial buyer liquidity and "
        "leaving researchers in prolonged financial limbo while the underlying vulnerability risks being patched independently by third parties."
    )

    add_heading_2(doc, "2.4 Attack Vectors, Griefing, and Surveillance in Vulnerability Exchange")
    add_paragraph(
        doc,
        "Beyond economic market failure, the transmission channel between buyer and seller is exposed to active adversarial threats:",
        bold_prefix="Adversarial Attack Vectors: "
    )
    add_paragraph(
        doc,
        "• Exploit Exfiltration & Plaintext Interception: Unencrypted transmission of vulnerability details over TLS can be inspected by malicious proxy exit nodes, "
        "cloud service providers, or state-level wiretaps, converting a coordinated defense into an immediate weaponized zero-day exposure."
    )
    add_paragraph(
        doc,
        "• Escrow Griefing & Denial-of-Inventory: A malicious buyer can repeatedly initiate escrow negotiations, lock up a seller's listing indefinitely without funding, "
        "preventing genuine buyers from acquiring the fix while the attacker searches for the bug internally.",
        bold_prefix="• Seller Stalling: "
    )
    add_paragraph(
        doc,
        "A malicious or negligent researcher can accept a locked bounty and refuse to reveal the decryption key, leaving the buyer's capital trapped in escrow "
        "indefinitely unless autonomous, deterministic timeout refund mechanisms are enforced at the smart contract level."
    )

    add_heading_2(doc, "2.5 Formal Mathematical Formulation of the Bilateral Verification Paradox")
    add_paragraph(
        doc,
        "Let V denote the comprehensive zero-day vulnerability payload consisting of technical documentation D and functional exploit code E, such that V = (D, E). "
        "Let the utility function of the buyer be denoted as U_B(V), where U_B(V) > 0 if and only if V satisfies specific verification criteria C (e.g., CVSS score >= 9.0, "
        "unauthenticated remote execution, reliable on target binary B). Let P denote the agreed financial bounty price."
    )
    add_paragraph(
        doc,
        "Under classical symmetric information exchange, transaction execution requires the simultaneous fulfillment of two mutually exclusive state conditions:"
    )
    add_paragraph(
        doc,
        "(Condition 1)  The buyer will disburse payment P if and only if C(V) = 1 is verified: P -> Seller <=> Verify(V, C) = 1.\n"
        "(Condition 2)  The seller will disclose payload V if and only if payment P is irrevocably received: V -> Buyer <=> Received(P) = 1.",
        italic=True
    )
    add_paragraph(
        doc,
        "Because verification Verify(V, C) requires technical knowledge of V, any sequential protocol where V is disclosed before P creates a subgame perfect "
        "equilibrium where the rational buyer sets P = 0 after observing V. Conversely, any sequential protocol where P is paid before V creates an equilibrium "
        "where the rational seller supplies V_lemon where C(V_lemon) = 0. Therefore, no pure-strategy equilibrium exists under sequential non-cryptographic exchange. "
        "Solving this dilemma requires decoupling the verification of attributes C(V) from the disclosure of payload V through cryptographic commitments."
    )

def build_section_3(doc):
    """Section 3: Solution Architecture & Cryptographic Primitives."""
    add_heading_1(doc, "3.0 SOLUTION ARCHITECTURE & CRYPTOGRAPHIC FOUNDATIONS")
    
    add_heading_2(doc, "3.1 The ZeroVault Protocol Philosophy & Security Model")
    add_paragraph(
        doc,
        "ZeroVault resolves the bilateral verification paradox through a hybrid architecture combining off-chain zero-knowledge partial disclosure with an "
        "immutable, on-chain EVM smart contract escrow. The governing philosophy of ZeroVault is built upon four inviolable architectural principles:",
        bold_prefix="Core Architectural Axioms: "
    )
    add_paragraph(
        doc,
        "1. Trustless Determinism: No trusted third-party arbitrator, escrow broker, or centralized cloud authority possesses custody of funds or control over "
        "state transitions. All escrow state changes are governed strictly by deterministic mathematical invariants encoded in Solidity."
    )
    add_paragraph(
        doc,
        "2. Verifiable Partial Disclosure: The researcher mathematically commits to the full vulnerability dataset upfront, allowing the buyer to verify authentic "
        "structural claims (CVSS metrics, component names, crash primitives) client-side before depositing capital, without disclosing actionable exploit payloads."
    )
    add_paragraph(
        doc,
        "3. Atomic Single-Transaction Settlement: The revelation of the decryption key and the financial disbursement of ETH occur atomically within the exact same "
        "EVM transaction (`revealAndClaim`), eliminating subjective dispute arbitration windows and multi-day capital lockups entirely."
    )
    add_paragraph(
        doc,
        "4. Symmetric Economic Safety Nets: Both parties are protected against counterparty inactivity via parameterized smart contract timeout mechanisms: "
        "a Dead Man's Switch authorizing public metadata disclosure if a vendor stalls, and an automated Reclaim Window refunding the buyer if a researcher stalls."
    )

    add_heading_2(doc, "3.2 Dual-Stage Cryptographic Pre-Commitment Scheme")
    add_paragraph(
        doc,
        "The cryptographic foundation of ZeroVault relies on a dual-stage commitment scheme that binds the encrypted vulnerability payload to the on-chain escrow "
        "before any commercial negotiation begins:",
        bold_prefix="Commitment Workflow: "
    )
    add_paragraph(
        doc,
        "Step 1: Symmetric Payload Encryption: The researcher generates a cryptographically secure 256-bit secret key K <- {0, 1}^256 using the Web Cryptography API "
        "(or Node.js crypto subsystem) and encrypts the full vulnerability payload V (containing technical documentation, exploit source code, and proof-of-concept scripts) "
        "using AES-256-GCM authenticated encryption. This generates ciphertext C, a 96-bit initialization vector IV, and a 128-bit authentication tag Tag: "
        "(C, IV, Tag) <- AES-GCM-Encrypt(K, V)."
    )
    add_paragraph(
        doc,
        "Step 2: On-Chain Key Hash Pre-Commitment: The researcher computes the cryptographic hash of the secret key using the EVM's native Keccak-256 hashing algorithm: "
        "H_K = Keccak-256(K). This 32-byte key hash H_K is committed immutably to the smart contract during listing creation, establishing a permanent cryptographic bond "
        "that prevents the researcher from substituting an alternate or defective decryption key during settlement."
    )

    add_heading_2(doc, "3.3 Merkle Tree Partial Disclosure & Client-Side Proof Verification")
    add_paragraph(
        doc,
        "To enable verifiable partial disclosure, the vulnerability's descriptive metadata is decomposed into N discrete semantic attributes (e.g., Affected Binary, "
        "Vulnerability Type, Attack Vector, Privileges Required, Scope, CVSS Base Score, Remediation Complexity). Each attribute is represented as a structured JSON object "
        "L_i = { index: i, trait_type: T_i, value: V_i, salt: S_i }, where S_i is a 256-bit pseudorandom salt preventing dictionary pre-image attacks on low-entropy fields."
    )
    add_paragraph(
        doc,
        "Each leaf node hash h_i is computed deterministically via Keccak-256: h_i = Keccak-256(EncodePacked(L_i)). The set of leaf hashes {h_0, h_1, ..., h_{N-1}} "
        "is sorted in lexicographical order (to prevent pair ambiguity and second-preimage attacks) and structured into a balanced binary Merkle Tree using `merkletreejs`. "
        "The resulting root of the tree, denoted as R = MerkleRoot(T), represents the succinct 32-byte cryptographic accumulator binding all vulnerability traits."
    )
    add_paragraph(
        doc,
        "When the researcher commits the vulnerability to the `ZeroVault.sol` contract via `commitVulnerability(R, H_K, vendor)`, the root R is permanently recorded. "
        "During pre-sale negotiations, the researcher selectively reveals a subset of leaf objects {L_k} alongside their corresponding Merkle audit paths {Proof_k}. "
        "The prospective buyer's Next.js client application executes the client-side verification function:"
    )
    add_paragraph(
        doc,
        "VerifyProof(Proof_k, R, Keccak-256(L_k)) == true",
        italic=True
    )
    add_paragraph(
        doc,
        "If the mathematical verification passes, the client interface renders an authenticated green badge ('Cryptographically Verified against On-Chain Root'). "
        "The buyer receives mathematical certainty that the revealed traits were fixed at the time of initial commitment and cannot be tampered with or retroactively altered."
    )

    add_heading_2(doc, "3.4 Atomic Single-Transaction Settlement Mechanism")
    add_paragraph(
        doc,
        "The most decisive architectural innovation of ZeroVault is the complete elimination of post-disclosure dispute arbitration. In prior legacy escrow designs "
        "(such as the initial Audit Pass 1 specification), an intermediate state (`PENDING_SETTLEMENT`) enforced a 48-hour dispute window during which a buyer could "
        "contest exploit validity. Formal security analysis revealed that this dispute window introduced severe game-theoretic vulnerabilities: a malicious buyer "
        "could receive the decryption key, decrypt the exploit, and immediately file a bad-faith dispute to freeze funds or extort a discount."
    )
    add_paragraph(
        doc,
        "ZeroVault replaces subjective dispute windows with atomic, single-transaction settlement executed through the smart contract function `revealAndClaim(merkleRoot, decryptionKey)`. "
        "The execution mechanics follow strict mathematical determinism:",
        bold_prefix="Settlement Sequence: "
    )
    add_paragraph(
        doc,
        "1. State Invariant Check: The contract verifies that the escrow is in the `BOUNTY_LOCKED` state, confirming that the buyer has already locked the full ETH bounty."
    )
    add_paragraph(
        doc,
        "2. Authorization Check: The contract confirms `msg.sender == escrow.seller`, ensuring only the rightful researcher can claim the payout."
    )
    add_paragraph(
        doc,
        "3. Cryptographic Pre-Image Verification: The contract hashes the plaintext decryption key supplied in the transaction payload and compares it against the "
        "committed key hash: `keccak256(bytes(decryptionKey)) == escrow.keyHash`. If the preimage does not match, the entire transaction reverts with `InvalidKey()`."
    )
    add_paragraph(
        doc,
        "4. Atomic Payout Execution: Following the Checks-Effects-Interactions (CEI) pattern, the contract transitions state to `SETTLED`, resets `escrow.bountyAmount = 0`, "
        "emits the settlement audit event, and transfers the locked ETH bounty to the researcher's wallet address in the exact same call frame."
    )
    add_paragraph(
        doc,
        "5. Key Disclosure & Payload Retrieval: The plaintext decryption key is transmitted securely to the buyer via authenticated session APIs, while the keccak256 hash "
        "is emitted on-chain for the audit trail. The buyer fetches the encrypted ciphertext from local storage and decrypts the zero-day payload locally in their browser."
    )

    add_heading_2(doc, "3.5 Formal Mathematical Security Invariants & Proof Sketches")
    add_paragraph(
        doc,
        "Theorem 1 (Pre-image Resistance & Key Secrecy): Prior to the execution of `revealAndClaim()`, the probability that an adversary (including the buyer, the API gateway, "
        "or an on-chain observer) can compute the decryption key K from the committed key hash H_K is negligible.",
        bold_prefix="Cryptographic Proof Sketches: "
    )
    add_paragraph(
        doc,
        "Proof Sketch: The key K is sampled uniformly at random from a key space of size 2^256: K <- {0, 1}^256. The hash function H = Keccak-256 is modeled as a random "
        "oracle satisfying pre-image resistance. Inverting H_K requires finding K' such that H(K') = H_K, which requires Omega(2^256) hash evaluations. Under standard "
        "cryptographic assumptions, this probability is bounded by epsilon <= 2^-256, rendering key extraction computationally infeasible. Q.E.D."
    )
    add_paragraph(
        doc,
        "Theorem 2 (Merkle Trait Inclusion Soundness): An untrusted researcher cannot forge a partial disclosure proof for a fabricated attribute L* that was not part of the "
        "original tree committed under root R.",
        bold_prefix="Theorem 2 (Proof Soundness): "
    )
    add_paragraph(
        doc,
        "Proof Sketch: Let T be the Merkle tree with root R. Suppose the researcher produces a valid proof Proof* for leaf claim L* such that VerifyProof(Proof*, R, Keccak-256(L*)) = true. "
        "If L* !in T, then along the verification path of depth d = log2(N), there must exist at least one internal collision where H(a || b) = H(a* || b*) with (a, b) != (a*, b*). "
        "Because Keccak-256 is collision-resistant, finding such a collision requires Omega(2^128) operations. Thus, forged trait inclusion is computationally impossible. Q.E.D."
    )
    add_paragraph(
        doc,
        "Theorem 3 (Settlement Atomicity & Non-Griefing): It is impossible for the researcher to receive the bounty payment without disclosing the valid decryption key K, "
        "and it is impossible for the buyer to obtain the valid decryption key K without the bounty being transferred to the researcher.",
        bold_prefix="Theorem 3 (Atomicity Invariant): "
    )
    add_paragraph(
        doc,
        "Proof Sketch: In EVM execution semantics, state modifications (state = SETTLED, balance transfers) and transaction execution are atomic. Within `revealAndClaim()`, "
        "the condition `keccak256(decryptionKey) == escrow.keyHash` must evaluate to true before `call{value: amount}` is invoked. If the key is invalid or omitted, "
        "the call reverts, leaving funds in escrow. If the call succeeds, the key has been validated and the funds transferred simultaneously. If the external ether transfer "
        "fails, the `TransferFailed()` error reverts all state changes. Thus, the payout and key reveal are strictly coupled. Q.E.D."
    )

print("Section data 1 built successfully.")
