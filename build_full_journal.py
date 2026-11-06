"""
Master Generator Script for ZeroVault_CIA2_Journal.docx
Assembles all sections, executes formatting, and writes output file.
"""

import os
import sys
import docx
from journal_builder import create_journal_document
from section_data_1 import build_title_page, build_abstract_and_toc, build_section_1, build_section_2, build_section_3
from section_data_2 import build_section_4, build_section_5, build_section_6
from section_data_3 import build_section_7, build_section_8, build_section_9_and_10
from section_data_4 import build_appendices

def generate_journal():
    print("Initializing document and configuring styles...")
    doc = create_journal_document()
    
    print("Building Title Page...")
    build_title_page(doc)
    
    print("Building Executive Abstract & Table of Contents...")
    build_abstract_and_toc(doc)
    
    print("Building Section 1: Introduction...")
    build_section_1(doc)
    
    print("Building Section 2: Problem Statement...")
    build_section_2(doc)
    
    print("Building Section 3: Solution Architecture...")
    build_section_3(doc)
    
    print("Building Section 4: System Architecture & Design...")
    build_section_4(doc)
    
    print("Building Section 5: Existing vs Proposed System...")
    build_section_5(doc)
    
    print("Building Section 6: Implementation Details...")
    build_section_6(doc)
    
    print("Building Section 7: Testing, Audits & Empirical Results...")
    build_section_7(doc)
    
    print("Building Section 8: Applications, Known Limitations & Future Scope...")
    build_section_8(doc)
    
    print("Building Section 9: Conclusion & Section 10: Academic References...")
    build_section_9_and_10(doc)
    
    print("Building Appendices A, B, and C...")
    build_appendices(doc)
    
    output_path = os.path.join(os.path.dirname(__file__), "ZeroVault_CIA2_Journal.docx")
    print(f"Saving completed journal to {output_path}...")
    doc.save(output_path)
    print("Document successfully generated and saved!")
    return output_path

if __name__ == "__main__":
    generate_journal()
