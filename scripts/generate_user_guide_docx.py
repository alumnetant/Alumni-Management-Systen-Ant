#!/usr/bin/env python3
"""
Generate Microsoft Word (.docx) for Appendix G: User Guide / Manual
AlumNet — St. Cecilia's College – Cebu, Inc.
"""

import os
import zipfile
import xml.etree.ElementTree as ET

def create_docx(filename="Documentation_Files/User_Guide_Manual.docx"):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    # [Content_Types].xml
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"""

    # _rels/.rels
    package_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    # word/_rels/document.xml.rels
    doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

    # word/styles.xml
    styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:color w:val="1F242E"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="360" w:lineRule="auto" w:after="160"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>"""

    # Helper function to generate document paragraphs
    doc_body = []

    def p(text, bold=False, italic=False, size=24, color="000000", align="left", space_before=0, space_after=140, bullet=False):
        b_tag = "<w:b/>" if bold else ""
        i_tag = "<w:i/>" if italic else ""
        jc_tag = f'<w:jc w:val="{align}"/>' if align != "left" else ""
        bullet_indent = '<w:ind w:left="480" w:hanging="240"/>' if bullet else ""
        bullet_char = '<w:r><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/><w:sz w:val="20"/></w:rPr><w:t>  </w:t></w:r>' if bullet else ""
        
        xml = f"""
        <w:p>
          <w:pPr>
            {jc_tag}
            {bullet_indent}
            <w:spacing w:before="{space_before}" w:after="{space_after}"/>
          </w:pPr>
          {bullet_char}
          <w:r>
            <w:rPr>
              {b_tag}
              {i_tag}
              <w:color w:val="{color}"/>
              <w:sz w:val="{size}"/>
            </w:rPr>
            <w:t xml:space="preserve">{text}</w:t>
          </w:r>
        </w:p>"""
        doc_body.append(xml)

    def heading1(text):
        p(text, bold=True, size=28, color="8B181B", align="left", space_before=280, space_after=120)

    def heading2(text):
        p(text, bold=True, size=26, color="1F242E", align="left", space_before=200, space_after=80)

    def heading3(text):
        p(text, bold=True, size=24, color="333333", align="left", space_before=160, space_after=60)

    def bullet_item(lead_bold, rest_text):
        xml = f"""
        <w:p>
          <w:pPr>
            <w:ind w:left="500" w:hanging="260"/>
            <w:spacing w:before="40" w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/><w:color w:val="8B181B"/></w:rPr>
            <w:t>• </w:t>
          </w:r>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="24"/><w:color w:val="1F242E"/></w:rPr>
            <w:t xml:space="preserve">{lead_bold}: </w:t>
          </w:r>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:color w:val="333333"/></w:rPr>
            <w:t xml:space="preserve">{rest_text}</w:t>
          </w:r>
        </w:p>"""
        doc_body.append(xml)

    def numbered_step(num, title, description):
        xml = f"""
        <w:p>
          <w:pPr>
            <w:ind w:left="500" w:hanging="300"/>
            <w:spacing w:before="60" w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="24"/><w:color w:val="8B181B"/></w:rPr>
            <w:t xml:space="preserve">{num}. </w:t>
          </w:r>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="24"/><w:color w:val="1F242E"/></w:rPr>
            <w:t xml:space="preserve">{title} — </w:t>
          </w:r>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:color w:val="333333"/></w:rPr>
            <w:t xml:space="preserve">{description}</w:t>
          </w:r>
        </w:p>"""
        doc_body.append(xml)

    def make_table(headers, rows):
        tbl_xml = ['<w:tbl>',
                   '<w:tblPr>',
                   '  <w:tblW w:w="9360" w:type="dxa"/>',
                   '  <w:tblBorders>',
                   '    <w:top w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>',
                   '    <w:left w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>',
                   '    <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>',
                   '    <w:right w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>',
                   '    <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E0E0E0"/>',
                   '    <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E0E0E0"/>',
                   '  </w:tblBorders>',
                   '</w:tblPr>']
        # Header Row
        tbl_xml.append('<w:tr><w:trPr><w:tblHeader/></w:trPr>')
        for h in headers:
            tbl_xml.append(f'''<w:tc>
              <w:tcPr>
                <w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>
                <w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar>
              </w:tcPr>
              <w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="8B181B"/></w:rPr><w:t>{h}</w:t></w:r></w:p>
            </w:tc>''')
        tbl_xml.append('</w:tr>')

        # Data Rows
        for row in rows:
            tbl_xml.append('<w:tr>')
            for cell in row:
                tbl_xml.append(f'''<w:tc>
                  <w:tcPr>
                    <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar>
                  </w:tcPr>
                  <w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="222222"/></w:rPr><w:t>{cell}</w:t></w:r></w:p>
                </w:tc>''')
            tbl_xml.append('</w:tr>')

        tbl_xml.append('</w:tbl>')
        doc_body.append('\n'.join(tbl_xml))

    # --- DOCUMENT CONTENT BUILDING ---
    # Header block
    p("APPENDIX G", bold=True, size=34, color="000000", align="center", space_before=100, space_after=60)
    p("USER GUIDE/MANUAL", bold=True, size=30, color="000000", align="center", space_before=0, space_after=140)
    p("ALUMNET: AN INTEGRATED ALUMNI TRACKING, CAREER ENGAGEMENT, AND EVENT NETWORKING PLATFORM", bold=True, size=24, color="8B181B", align="center", space_before=0, space_after=60)
    p("St. Cecilia’s College – Cebu, Inc.", italic=True, size=24, color="555555", align="center", space_before=0, space_after=280)

    # 1. Introduction
    heading1("1. Introduction")
    p("This guide provides step-by-step instructions on how to use the features of the system. It is intended for Public Users, Cecilian Alumni, Corporate Recruiters, and Administrators, helping them navigate, manage, and operate the system efficiently.", align="both")
    
    p("1.1 Background & Problems Addressed by the System", bold=True, size=24, color="333333", space_before=140, space_after=60)
    bullet_item("Graduate Career Blindspots", "When students graduate, colleges traditionally lose track of their whereabouts, employment trajectories, and course-job relevance, creating a major gap during institutional and CHED accreditation reviews.")
    bullet_item("Chaotic and Fragmented Event Communication", "Whenever campus homecomings or seminars are held, organizing alumni into scattered messaging groups (e.g., disjointed Messenger threads) causes lost invitations, logistics chaos, and low attendance.")
    bullet_item("Registrar Discrepancies & Falsification", "Physical paper credentials and unverified registries risk inaccurate alumni records. AlumNet binds every profile directly to verified registrar records.")

    p("The system has been developed to:", bold=True, size=24, color="1F242E", space_before=140, space_after=80)
    bullet_item("Centralize Graduate Tracking", "Track alumni employment status, industry sectors, and degree alignment in real-time.")
    bullet_item("Automate Event Group Chats", "Automatically admit registered attendees into official event group chats immediately upon RSVP.")
    bullet_item("Issue 3D Digital Alumni Cards", "Provide verified graduates with permanent, interactive 3D digital cards featuring encrypted QR verification.")
    bullet_item("Facilitate Direct Career Pathways", "Host verified corporate job listings with 1-click PDF resume applications and real-time candidate management.")
    bullet_item("Guarantee Identity Integrity", "Cross-match registrations against the official registrar masterlist prior to account activation.")

    # 2. Getting Started
    heading1("2. Getting Started")
    heading2("2.1 System Requirements")
    bullet_item("Operating Systems", "Windows 10 or higher, macOS 11+, Linux (Ubuntu/Debian), Android 9.0 and above, iOS 14+.")
    bullet_item("Web Browsers", "Google Chrome, Mozilla Firefox, Apple Safari, Microsoft Edge (latest versions).")
    bullet_item("Hardware", "Desktop, laptop, or mobile smartphone with camera support (for contactless QR ticket scanning).")
    bullet_item("Internet", "Wi-Fi or cellular mobile data connection (minimum 2 Mbps download/upload speed).")

    heading2("2.2 Accessing the System")
    numbered_step("1", "Open Web Browser", "Launch any supported desktop or mobile browser, or open the installed Progressive Web App (PWA).")
    numbered_step("2", "Enter Platform URL", "Navigate to https://alumnet.stcecilia.edu.ph or scan the official QR code provided by the alumni office.")
    numbered_step("3", "Select Login Mode", "Authenticate according to your assigned institutional role:")
    bullet_item("Public User", "No login required. View public announcements, homecoming schedules, and general tracer stats.")
    bullet_item("Alumni", "Log in using verified Student ID number or registered email and secure password.")
    bullet_item("Corporate Recruiter", "Log in using verified industry partner credentials.")
    bullet_item("Administrator", "Log in with institutional administrator credentials (Alumni Affairs Office & Registrar).")

    # 3. User Roles and Permissions
    heading1("3. User Roles and Permissions")
    heading2("3.1 Public Users / Campus Visitors")
    bullet_item("Campus News & Circulars", "Browse institutional bulletins, homecoming announcements, and general collegiate updates.")
    bullet_item("Institutional Metrics", "View overall graduate employment percentages and CHED accreditation milestones.")
    bullet_item("Alumni Registration Portal", "Access the onboarding portal to initiate student ID verification.")
    bullet_item("Restrictions", "Cannot view private alumni profiles, contact numbers, event group chats, or recruiter candidate pools.")

    heading2("3.2 Cecilian Alumni")
    bullet_item("Identity Verification", "Claim alumni profile via automated registrar masterlist cross-matching.")
    bullet_item("Live Employment Tracer", "Submit and maintain job title, employer name, industry sector, and degree alignment.")
    bullet_item("3D Digital Alumni ID", "Rotate and inspect permanent 3D digital card with dynamic encrypted QR verification.")
    bullet_item("Event RSVP & Auto Chat", "Reserve event tickets and gain automatic instant entry into official event group chats.")
    bullet_item("Corporate Career Hub", "Search verified vacancies, submit PDF resumes in one click, and track hiring stages.")
    bullet_item("Community Circles", "Direct message verified alumni and interact in batch-specific discussion circles.")

    heading2("3.3 Corporate Recruiters / Industry Partners")
    bullet_item("Company Profile", "Maintain verified corporate branding, recruiter credentials, and company contact points.")
    bullet_item("Job Vacancy Management", "Publish internships, entry-level, and senior openings targeted to Cecilian degree holders.")
    bullet_item("Candidate Review", "Filter applicants by degree and batch, preview PDF resumes, and update recruitment pipeline statuses.")

    heading2("3.4 Institutional Administrators (Alumni Affairs & Registrar)")
    bullet_item("Tracer Analytics", "Access live visual dashboards with employment percentages, salary distributions, and CHED alignment.")
    bullet_item("QR Event Scanner", "Execute contactless check-in during campus reunions with audio-visual validation.")
    bullet_item("Registrar Triage", "Resolve unverified alumni claims by inspecting uploaded diplomas or transcripts.")
    bullet_item("Account Provisioning", "Create institutional accounts under strict role-based access control and moderator quotas.")

    # 4. Step-by-Step Alumni User Instructions
    heading1("4. Step-by-Step Alumni User Instructions")
    heading2("4.1 Alumni Onboarding & Masterlist Verification")
    numbered_step("1", "Registration Entry", "On the login screen, click 'Register as Alumni'.")
    numbered_step("2", "Input Academic Details", "Enter your Student ID (e.g. 2022-0412), Full Name, Degree Program, and Graduation Year.")
    numbered_step("3", "Automated Validation", "The system verifies details against registrar master records. If verified, set your password; if a discrepancy occurs, upload your TOR or Diploma for manual registrar review.")
    numbered_step("4", "Access Granted", "Your verified account unlocks your personal dashboard and generates your 3D Digital Alumni ID.")

    heading2("4.2 Updating the Graduate Employment Tracer")
    numbered_step("1", "Open Tracer Tab", "Click 'Tracer / My Career' on the primary navigation menu.")
    numbered_step("2", "Edit Details", "Select 'Update Employment Profile'.")
    numbered_step("3", "Complete Survey", "Input your employment status, company name, job title, work location, and course-job alignment.")
    numbered_step("4", "Save & Sync", "Click 'Save Changes'. Institutional tracer metrics update in real time.")

    heading2("4.3 Event Registration & Automatic Group Chat Access")
    numbered_step("1", "Explore Events", "Navigate to the 'Events' section.")
    numbered_step("2", "Select Event", "Choose an upcoming event (e.g., Grand Alumni Homecoming 2026).")
    numbered_step("3", "Reserve Pass", "Click 'Reserve Seat / Get Pass'.")
    numbered_step("4", "Dynamic QR & Auto-Join Chat", "An encrypted QR ticket pass is issued to your wallet, and you are automatically enrolled into the official Event Group Chat lounge with fellow attendees.")

    heading2("4.4 Operating the 3D Digital Alumni ID Card")
    numbered_step("1", "Open Digital ID", "Select 'Digital ID' from the user menu.")
    numbered_step("2", "Interactive Inspection", "Click and drag to tilt the card in 3D, observing the official gold seal and holographic band.")
    numbered_step("3", "Flip for QR Code", "Click 'Flip Card' to show the dynamic QR code for entry validation at campus gates.")

    heading2("4.5 Career Applications & Job Hub")
    numbered_step("1", "Browse Opportunities", "Open 'Careers & Jobs' and filter by department or employment type.")
    numbered_step("2", "Quick Apply", "Click 'Quick Apply' on any listing to submit your verified profile and PDF resume.")
    numbered_step("3", "Track Status", "Monitor application stages (Submitted, Reviewing, Shortlisted, Interview) under 'My Applications'.")

    # 5. Corporate Recruiter Operating Procedures
    heading1("5. Corporate Recruiter Operating Procedures")
    heading2("5.1 Employer Setup & Accreditation")
    numbered_step("1", "Partner Registration", "Sign up through the Employer Portal and provide official company accreditation details.")
    numbered_step("2", "Verification", "Once approved by the Alumni Affairs Office, full posting privileges are granted.")

    heading2("5.2 Publishing Vacancies & Reviewing Talent")
    numbered_step("1", "Post Job", "Enter role title, academic qualification, compensation tier, and responsibilities.")
    numbered_step("2", "Review Applications", "Open candidate dossiers, download candidate PDF resumes, and update hiring pipeline status.")

    # 6. Administrator & Registrar Procedures
    heading1("6. Administrator & Registrar Procedures")
    heading2("6.1 Graduate Tracer Analytics & Reporting")
    numbered_step("1", "View Tracer Dashboard", "Monitor live charts for overall employment rate, program alignment, and sector distribution.")
    numbered_step("2", "Filter Cohorts", "Filter by department (e.g., Computer Studies, Business, Education) or specific batch year.")
    numbered_step("3", "Export Reports", "Click 'Export Audit Report' to download CHED-compliant summaries in PDF or Excel.")

    heading2("6.2 Contactless QR Event Check-In Desk")
    numbered_step("1", "Launch Scanner", "Under Events Management, click 'Launch QR Ticket Scanner'.")
    numbered_step("2", "Optical Verification", "Scan arriving alumni digital tickets via webcam or optical scanner. Valid tickets chime green; duplicate passes trigger an immediate security alert.")

    heading2("6.3 Account Provisioning & Validation Rules")
    numbered_step("1", "Add Member", "Click 'Add Member' on the admin dashboard.")
    numbered_step("2", "Input Details", "Provide Full Name, Institutional Email, System Role, and Default Password.")
    numbered_step("3", "System Enforcement", "System validates required fields, prevents duplicate email accounts, and enforces the 3-moderator quota limit.")
    numbered_step("4", "Confirmation", "Upon completion, the system shows 'ADDING MEMBER SUCCESSFULLY!' with the assigned role.")

    # 7. Troubleshooting & Diagnostic Matrix
    heading1("7. Troubleshooting & Diagnostic Matrix")
    headers = ["Issue / Error Message", "Probable Cause", "Recommended Resolution"]
    rows = [
        ["Student ID Not Found in Masterlist", "Typographical error or legacy record not yet digitized.", "Verify format (e.g., 2022-0412). If correct, click 'Request Manual Verification' and upload Diploma/TOR."],
        ["Invalid or Duplicate QR Pass", "Pass already checked in or screen brightness is too low.", "Increase display brightness or check attendee identity in manual admin roster."],
        ["Group Chat Access Restricted", "Event reservation cancelled or event archived.", "Check pass status in 'My Passes' and click 'Re-sync Event Channels'."],
        ["Moderator Quota Limit Reached", "Max 3 active moderators already exist.", "Deactivate an unused moderator account before creating or promoting a new one."],
        ["3D Digital ID Fails to Rotate", "Hardware acceleration disabled or low GPU memory.", "Enable hardware acceleration in browser settings or toggle 2D static view."],
        ["Resume Upload Failed", "File exceeds 10 MB or is not PDF.", "Ensure document is formatted as PDF and under 10 MB in file size."]
    ]
    make_table(headers, rows)

    # 8. Institutional Contact Information
    heading1("8. Institutional Contact Information & Support")
    bullet_item("Office", "Alumni Affairs & Placement Office / Office of the Registrar")
    bullet_item("Institution", "St. Cecilia’s College – Cebu, Inc.")
    bullet_item("Campus Address", "Ward II, Poblacion, Minglanilla, Cebu, Philippines 6046")
    bullet_item("Official Email", "alumni.office@stcecilia.edu.ph / registrar@stcecilia.edu.ph")
    bullet_item("Helpdesk Hotline", "(032) 272-3604 / (032) 490-2500")
    bullet_item("Operating Hours", "Monday to Friday, 8:00 AM – 5:00 PM (Philippine Standard Time)")

    p("© 2026 St. Cecilia’s College – Cebu, Inc. AlumNet Project Team. All rights reserved. Appendix G of official manuscript.", italic=True, size=20, color="666666", align="center", space_before=240, space_after=100)

    # Page properties (Letter size, 1 inch margins)
    section_props = """
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>"""

    # Assemble document.xml
    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(doc_body)}
    {section_props}
  </w:body>
</w:document>"""

    # Package into .docx zip container
    with zipfile.ZipFile(filename, 'w', compression=zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types)
        docx.writestr("_rels/.rels", package_rels)
        docx.writestr("word/_rels/document.xml.rels", doc_rels)
        docx.writestr("word/styles.xml", styles_xml)
        docx.writestr("word/document.xml", document_xml)

    print(f"Generated {filename} successfully ({os.path.getsize(filename)} bytes).")

if __name__ == "__main__":
    create_docx()
