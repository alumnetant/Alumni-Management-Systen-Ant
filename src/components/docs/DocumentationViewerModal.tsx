import React, { useState } from 'react';
import {
  X,
  FileCode,
  FileText,
  Layers,
  Download,
  Copy,
  Check,
  Search,
  Users,
  Database,
  Network,
  Eye,
  BookOpen,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';

interface DocumentationViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'narratives' | 'usecase' | 'erd' | 'matrix';
}

export const DocumentationViewerModal: React.FC<DocumentationViewerModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'narratives'
}) => {
  const { showToast } = useAlumni();
  const [activeTab, setActiveTab] = useState<'narratives' | 'usecase' | 'erd' | 'matrix'>(initialTab);
  const [useCaseViewMode, setUseCaseViewMode] = useState<'svg' | 'xml'>('svg');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [narrativeSearch, setNarrativeSearch] = useState('');
  const [narrativeRoleFilter, setNarrativeRoleFilter] = useState('all');

  if (!isOpen) return null;

  const handleCopy = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    showToast(`${sectionName} copied to clipboard!`, 'success');
    setTimeout(() => {
      setCopiedSection(null);
    }, 2500);
  };

  const handleDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, 'success');
  };

  // RAW DRAW.IO XML FOR USE CASE DIAGRAM
  const useCaseDrawioXml = `<mxfile host="app.diagrams.net" modified="2026-11-04T08:00:00.000Z" agent="Mozilla/5.0" version="24.0.0" type="device">
  <diagram id="StCeciliasAlumnetUseCase" name="St. Cecilia's College Use Case Diagram">
    <mxGraphModel dx="1422" dy="850" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1500" pageHeight="1050" background="#FAF9F6">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="sys_boundary" value="ST. CECILIA'S COLLEGE - CEBU, INC. ALUMNET SYSTEM BOUNDARY" style="swimlane;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#8B181B;strokeWidth=2.5;fontColor=#8B181B;fontStyle=1;fontSize=13;startSize=30;rounded=1;arcSize=4;" vertex="1" parent="1">
          <mxGeometry x="240" y="40" width="840" height="920" as="geometry"/>
        </mxCell>
        <mxCell id="uc_01" value="UC-01: Authenticate Session via&#xa;PBKDF2 &amp; Biometrics" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="60" width="230" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_05" value="UC-05: Generate &amp; Flip&#xa;Digital Alumni ID Card" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="145" width="230" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_06" value="UC-06: Publish, React &amp; Moderate&#xa;Campus Social Feed" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="230" width="230" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_07" value="UC-07: Search Verified Alumni&#xa;Directory &amp; Connect" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="315" width="230" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_08" value="UC-08: Gated Direct Messaging&#xa;with Connected Peer" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="405" width="230" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_10" value="UC-10: Apply for Job Vacancy &amp;&#xa;Export Certified PDF Resume" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="495" width="230" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_04" value="UC-04: Student Clearance &amp;&#xa;Degree Verification" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="60" width="240" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_11" value="UC-11: Schedule Campus Events&#xa;&amp; Confirm RSVPs" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="145" width="240" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_12" value="UC-12: Broadcast Bulletins&#xa;&amp; Dispatch Push Alerts" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="230" width="240" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_09" value="UC-09: Corporate Accreditation&#xa;&amp; Job Posting Management" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="320" width="240" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_02" value="UC-02: Security Audit Logs &amp;&#xa;Threat Intelligence" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="415" width="240" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_03" value="UC-03: Account Suspension &amp;&#xa;Lock Scheduler" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="510" width="240" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_13" value="UC-13: Superadmin Governance&#xa;&amp; Deletion Guardrail" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="605" width="240" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="uc_14" value="UC-14: Automated Account&#xa;Restoration Daemon" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="700" width="240" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="act_alumni" value="Alumni Member&#xa;(Verified Graduate)" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;strokeColor=#8B181B;strokeWidth=2;fillColor=#FAF9F6;fontStyle=1;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="70" y="240" width="45" height="90" as="geometry"/>
        </mxCell>
        <mxCell id="act_employer" value="Employer Partner&#xa;(Corporate Recruiter)" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;strokeColor=#8B181B;strokeWidth=2;fillColor=#FAF9F6;fontStyle=1;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="70" y="560" width="45" height="90" as="geometry"/>
        </mxCell>
        <mxCell id="act_moderator" value="Institutional Moderator&#xa;(Registrar / Events / Circulars)" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;strokeColor=#8B181B;strokeWidth=2;fillColor=#FAF9F6;fontStyle=1;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1190" y="160" width="45" height="90" as="geometry"/>
        </mxCell>
        <mxCell id="act_admin" value="System Administrator&#xa;(Security &amp; Suspensions)" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;strokeColor=#8B181B;strokeWidth=2;fillColor=#FAF9F6;fontStyle=1;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1190" y="460" width="45" height="90" as="geometry"/>
        </mxCell>
        <mxCell id="act_superadmin" value="Superadministrator&#xa;(Root Authority)" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;strokeColor=#8B181B;strokeWidth=2;fillColor=#FAF9F6;fontStyle=1;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1190" y="720" width="45" height="90" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_01" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_01">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_05" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_05">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_06" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_06">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_07" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_07">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_08" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_08">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_10" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_10">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_employer_09" style="endArrow=none;html=1;entryX=0.5;entryY=1;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_employer" target="uc_09">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_employer_10" style="endArrow=none;html=1;entryX=0.5;entryY=1;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_employer" target="uc_10">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_mod_04" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_moderator" target="uc_04">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_mod_11" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_moderator" target="uc_11">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_mod_12" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_moderator" target="uc_12">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_mod_06" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_moderator" target="uc_06">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_admin_02" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_admin" target="uc_02">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_admin_03" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_admin" target="uc_03">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_super_13" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_superadmin" target="uc_13">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="gen_super_admin" style="endArrow=block;endSize=12;dashed=1;html=1;strokeColor=#8B181B;strokeWidth=2;fillColor=#8B181B;" edge="1" parent="1" source="act_superadmin" target="act_admin">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  // RAW DRAW.IO XML FOR ERD
  const erdDrawioXml = `<mxfile host="app.diagrams.net" modified="2026-11-04T08:00:00.000Z" agent="Mozilla/5.0" version="24.0.0" type="device">
  <diagram id="StCeciliasAlumnetERD" name="St. Cecilia's College Alumnet ERD">
    <mxGraphModel dx="1422" dy="850" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1100" background="#FFFFFF">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="ent_users" value="&lt;b&gt;USERS&lt;/b&gt;&lt;hr&gt;+ uid: VARCHAR [PK]&lt;br&gt;+ email: VARCHAR [UNIQUE]&lt;br&gt;+ name: VARCHAR&lt;br&gt;+ password_hash: VARCHAR&lt;br&gt;+ password_salt: VARCHAR&lt;br&gt;+ role: VARCHAR [ENUM]&lt;br&gt;+ account_status: VARCHAR [ENUM]&lt;br&gt;+ student_id: VARCHAR [FK]&lt;br&gt;+ batch: VARCHAR&lt;br&gt;+ course: VARCHAR&lt;br&gt;+ is_verified: BOOLEAN&lt;br&gt;+ company: VARCHAR&lt;br&gt;+ current_position: VARCHAR&lt;br&gt;+ suspension_start: TIMESTAMP&lt;br&gt;+ suspension_end: TIMESTAMP&lt;br&gt;+ suspension_reason: TEXT&lt;br&gt;+ created_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#8B181B;fontColor=#FFFFFF;strokeColor=#5B0F11;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="60" y="80" width="230" height="300" as="geometry"/>
        </mxCell>
        <mxCell id="ent_masterlist" value="&lt;b&gt;REGISTRAR_MASTERLIST&lt;/b&gt;&lt;hr&gt;+ student_id: VARCHAR [PK]&lt;br&gt;+ full_name: VARCHAR&lt;br&gt;+ degree_program: VARCHAR&lt;br&gt;+ graduation_year: VARCHAR&lt;br&gt;+ latin_honors: VARCHAR&lt;br&gt;+ clearance_status: VARCHAR&lt;br&gt;+ is_claimed: BOOLEAN&lt;br&gt;+ verified_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#2B0709;fontColor=#FFFFFF;strokeColor=#180405;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="380" y="80" width="220" height="170" as="geometry"/>
        </mxCell>
        <mxCell id="ent_audit_logs" value="&lt;b&gt;AUDIT_LOGS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ action: VARCHAR [ENUM]&lt;br&gt;+ actor_id: VARCHAR [FK]&lt;br&gt;+ actor_name: VARCHAR&lt;br&gt;+ actor_role: VARCHAR&lt;br&gt;+ target_user_id: VARCHAR [FK]&lt;br&gt;+ category: VARCHAR&lt;br&gt;+ severity: VARCHAR&lt;br&gt;+ details: TEXT&lt;br&gt;+ suspension_reason: TEXT&lt;br&gt;+ ip_address: VARCHAR&lt;br&gt;+ timestamp: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#1C1917;fontColor=#FFFFFF;strokeColor=#0C0A09;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="60" y="460" width="230" height="230" as="geometry"/>
        </mxCell>
        <mxCell id="ent_suspension_history" value="&lt;b&gt;SUSPENSION_HISTORY&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ user_id: VARCHAR [FK]&lt;br&gt;+ admin_id: VARCHAR [FK]&lt;br&gt;+ admin_name: VARCHAR&lt;br&gt;+ action: VARCHAR&lt;br&gt;+ reason: TEXT&lt;br&gt;+ start_date: TIMESTAMP&lt;br&gt;+ end_date: TIMESTAMP&lt;br&gt;+ notes: TEXT&lt;br&gt;+ created_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#44403C;fontColor=#FFFFFF;strokeColor=#292524;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="380" y="320" width="220" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="ent_feed_posts" value="&lt;b&gt;FEED_POSTS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ author_id: VARCHAR [FK]&lt;br&gt;+ author_name: VARCHAR&lt;br&gt;+ author_role: VARCHAR&lt;br&gt;+ title: VARCHAR&lt;br&gt;+ content: TEXT&lt;br&gt;+ post_type: VARCHAR&lt;br&gt;+ image_url: VARCHAR&lt;br&gt;+ created_at: TIMESTAMP&lt;br&gt;+ updated_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#8B181B;fontColor=#FFFFFF;strokeColor=#5B0F11;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="690" y="80" width="220" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="ent_feed_comments" value="&lt;b&gt;FEED_COMMENTS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ post_id: VARCHAR [FK]&lt;br&gt;+ author_id: VARCHAR [FK]&lt;br&gt;+ author_name: VARCHAR&lt;br&gt;+ content: TEXT&lt;br&gt;+ created_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#A82024;fontColor=#FFFFFF;strokeColor=#731417;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="690" y="350" width="220" height="150" as="geometry"/>
        </mxCell>
        <mxCell id="ent_feed_hearts" value="&lt;b&gt;FEED_HEARTS&lt;/b&gt;&lt;hr&gt;+ post_id: VARCHAR [PK, FK]&lt;br&gt;+ user_id: VARCHAR [PK, FK]&lt;br&gt;+ reacted_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#D97706;fontColor=#FFFFFF;strokeColor=#92400E;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="690" y="550" width="220" height="90" as="geometry"/>
        </mxCell>
        <mxCell id="ent_announcements" value="&lt;b&gt;ANNOUNCEMENTS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ author_id: VARCHAR [FK]&lt;br&gt;+ author_name: VARCHAR&lt;br&gt;+ title: VARCHAR&lt;br&gt;+ content: TEXT&lt;br&gt;+ category: VARCHAR&lt;br&gt;+ is_pinned: BOOLEAN&lt;br&gt;+ urgent: BOOLEAN&lt;br&gt;+ image_url: VARCHAR&lt;br&gt;+ published_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#1E293B;fontColor=#FFFFFF;strokeColor=#0F172A;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1000" y="80" width="220" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="ent_events" value="&lt;b&gt;EVENTS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ organizer_id: VARCHAR [FK]&lt;br&gt;+ title: VARCHAR&lt;br&gt;+ description: TEXT&lt;br&gt;+ event_date: TIMESTAMP&lt;br&gt;+ location: VARCHAR&lt;br&gt;+ capacity: INTEGER&lt;br&gt;+ image_url: VARCHAR&lt;br&gt;+ created_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#0F766E;fontColor=#FFFFFF;strokeColor=#115E59;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1000" y="340" width="220" height="190" as="geometry"/>
        </mxCell>
        <mxCell id="ent_event_rsvps" value="&lt;b&gt;EVENT_RSVPS&lt;/b&gt;&lt;hr&gt;+ event_id: VARCHAR [PK, FK]&lt;br&gt;+ user_id: VARCHAR [PK, FK]&lt;br&gt;+ status: VARCHAR [ENUM]&lt;br&gt;+ rsvp_date: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#0D9488;fontColor=#FFFFFF;strokeColor=#115E59;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1000" y="580" width="220" height="110" as="geometry"/>
        </mxCell>
        <mxCell id="ent_jobs" value="&lt;b&gt;JOB_POSTINGS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ employer_id: VARCHAR [FK]&lt;br&gt;+ company_name: VARCHAR&lt;br&gt;+ title: VARCHAR&lt;br&gt;+ description: TEXT&lt;br&gt;+ location: VARCHAR&lt;br&gt;+ salary_range: VARCHAR&lt;br&gt;+ job_type: VARCHAR [ENUM]&lt;br&gt;+ status: VARCHAR [ACTIVE/CLOSED]&lt;br&gt;+ created_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#1D4ED8;fontColor=#FFFFFF;strokeColor=#1E40AF;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1300" y="80" width="230" height="210" as="geometry"/>
        </mxCell>
        <mxCell id="ent_job_apps" value="&lt;b&gt;JOB_APPLICATIONS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ job_id: VARCHAR [FK]&lt;br&gt;+ applicant_id: VARCHAR [FK]&lt;br&gt;+ resume_url: VARCHAR&lt;br&gt;+ cover_letter: TEXT&lt;br&gt;+ status: VARCHAR [PENDING/REVIEW]&lt;br&gt;+ submitted_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#2563EB;fontColor=#FFFFFF;strokeColor=#1D4ED8;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1300" y="350" width="230" height="160" as="geometry"/>
        </mxCell>
        <mxCell id="ent_connections" value="&lt;b&gt;CONNECTIONS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ requester_id: VARCHAR [FK]&lt;br&gt;+ addressee_id: VARCHAR [FK]&lt;br&gt;+ status: VARCHAR [ACCEPTED/PENDING]&lt;br&gt;+ connected_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#475569;fontColor=#FFFFFF;strokeColor=#334155;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="380" y="580" width="220" height="130" as="geometry"/>
        </mxCell>
        <mxCell id="ent_messages" value="&lt;b&gt;DIRECT_MESSAGES&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ sender_id: VARCHAR [FK]&lt;br&gt;+ receiver_id: VARCHAR [FK]&lt;br&gt;+ message_body: TEXT&lt;br&gt;+ is_read: BOOLEAN&lt;br&gt;+ sent_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#334155;fontColor=#FFFFFF;strokeColor=#1E293B;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="380" y="760" width="220" height="150" as="geometry"/>
        </mxCell>
        <mxCell id="rel_users_masterlist" value="1 : 1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.25;entryX=0;entryY=0.25;strokeColor=#8B181B;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_masterlist">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_users_audit" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#1C1917;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_audit_logs">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_users_suspension" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.7;entryX=0;entryY=0.3;strokeColor=#44403C;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_suspension_history">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_users_posts" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.1;entryX=0;entryY=0.2;strokeColor=#8B181B;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_feed_posts">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_posts_comments" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#A82024;strokeWidth=2;" edge="1" parent="1" source="ent_feed_posts" target="ent_feed_comments">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_posts_hearts" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#D97706;strokeWidth=2;" edge="1" parent="1" source="ent_feed_comments" target="ent_feed_hearts">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_users_announcements" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.05;entryX=0;entryY=0.2;strokeColor=#1E293B;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_announcements">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_users_events" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.5;entryX=0;entryY=0.2;strokeColor=#0F766E;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_events">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_events_rsvps" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#0D9488;strokeWidth=2;" edge="1" parent="1" source="ent_events" target="ent_event_rsvps">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_users_jobs" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.02;entryX=0;entryY=0.1;strokeColor=#1D4ED8;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_jobs">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_jobs_apps" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#2563EB;strokeWidth=2;" edge="1" parent="1" source="ent_jobs" target="ent_job_apps">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_users_connections" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.9;entryX=0;entryY=0.5;strokeColor=#475569;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_connections">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_conn_messages" value="Gated 1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#334155;strokeWidth=2;" edge="1" parent="1" source="ent_connections" target="ent_messages">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  const narratives = [
    {
      id: 'UC-01',
      title: 'Authenticate Session via PBKDF2 Vault & WebAuthn Biometrics',
      actor: 'Alumni / Employer / Moderator / Admin',
      scope: 'Authentication & Vault Subsystem',
      preconditions: 'Account is registered and lifecycle status is ACTIVE.',
      trigger: 'User submits credentials or touches biometric prompt.',
      normalFlow: [
        'User enters institutional identifier and secret password.',
        'System derives PBKDF2 key over 100,000 SHA-256 iterations using stored salt.',
        'System matches derived hash against stored cryptographic credential.',
        'System verifies account_status === "ACTIVE".',
        'System logs USER_LOGIN (NORMAL status, no warning icon).',
        'System issues session token and routes user to role workspace.'
      ],
      altFlows: [
        'Single password mismatch logs FAILED_LOGIN_ATTEMPT (WARNING, ⚠️ Yes).',
        '3 consecutive mismatches logs MULTIPLE_FAILED_LOGIN_ATTEMPTS (SUSPICIOUS, ⚠️ Yes).',
        '5 consecutive mismatches locks account into ACCOUNT_LOCKED (LOCKED, ⚠️ Yes).',
        'Suspended account renders suspension duration and administrative explanation modal.'
      ],
      postconditions: 'Authenticated session granted; audit logged.'
    },
    {
      id: 'UC-02',
      title: 'Security Audit Logging & Suspicious Multi-User Detection',
      actor: 'Automated Security Engine (System Daemon)',
      scope: 'Security Threat Intelligence Engine',
      preconditions: 'Active sessions receiving concurrent request telemetry.',
      trigger: 'Simultaneous incoming requests from conflicting geographic locations or devices.',
      normalFlow: [
        'Security daemon intercepts incoming telemetry and compares session timestamps.',
        'Legitimate dual-device usage (mobile app + desktop) is validated and permitted.',
        'If conflicting simultaneous interactions or geographical impossibility occur:',
        'System logs MULTIPLE_USERS_SAME_ACCOUNT with status SUSPICIOUS and ⚠️ Yes.',
        'Real-time alert toast dispatched to active Administrators.'
      ],
      altFlows: [
        'Admin investigates log in audit inspector drawer and initiates temporary suspension.'
      ],
      postconditions: 'Threat payload recorded with masked passwords.'
    },
    {
      id: 'UC-03',
      title: 'Account Suspension & Lock Scheduler with Mandatory Reason',
      actor: 'System Administrator / Superadministrator',
      scope: 'Administrative Governance Subsystem',
      preconditions: 'Actor has canAccessAdminPanel permissions. Target user is registered.',
      trigger: 'Admin clicks "Suspend" or "Lock" in administrative users table.',
      normalFlow: [
        'Admin opens Account Suspension & Lock Scheduler Modal.',
        'Admin selects duration preset (1 hr, 24 hrs, 3 days, 7 days, 15 days, 30 days) or custom date.',
        'System computes suspensionStartDate and suspensionEndDate.',
        'Admin inputs mandatory Suspension Reason.',
        'Admin confirms; user state transitions to SUSPENDED.',
        'Active tokens terminated; audit logged as ACCOUNT_SUSPENDED (SUSPENDED, ⚠️ Yes).'
      ],
      altFlows: [
        'Leaving reason blank triggers validation error.',
        'Permanent lock sets indefinite duration and ACCOUNT_LOCKED.',
        'Manual early restore logs ADMIN_UNLOCKED_ACCOUNT (NORMAL, No warning icon).'
      ],
      postconditions: 'Target user blocked from sign-in until expiration or unlock.'
    },
    {
      id: 'UC-04',
      title: 'Student Academic Records Clearance & Degree Verification',
      actor: 'Institutional Moderator (Consolidated Registrar Role)',
      scope: 'Academic Records & Accreditation Subsystem',
      preconditions: 'Graduate registered with Student ID (YYYY-NNNNN) or uploaded proof.',
      trigger: 'Moderator opens academic clearance queue or alumnus clicks instant match.',
      normalFlow: [
        'Moderator reviews student ID and degree program in clearance queue.',
        'System queries registrar masterlist and renders program and Latin honors.',
        'Moderator reviews clearance status and clicks "Approve & Certify Graduate".',
        'Alumnus status transitions to isVerified = true with ShieldCheck emblem.',
        'Cryptographic Alumni ID serial number generated.',
        'Audit log records REGISTRAR_VERIFIED_STUDENT (NORMAL, no warning icon).'
      ],
      altFlows: [
        'Unlisted student ID prompts manual diploma/TOR review with moderator.'
      ],
      postconditions: 'Alumnus credential accredited; Digital ID activated.'
    },
    {
      id: 'UC-05',
      title: 'Generate & Flip Signature Digital Alumni ID Card',
      actor: 'Verified Alumni Member',
      scope: 'Digital Credential Subsystem',
      preconditions: 'User is authenticated with verified alumni degree standing.',
      trigger: 'Alumnus navigates to Profile and selects Digital Alumni ID.',
      normalFlow: [
        'System renders card front: Transparent College Seal, deep crimson gradient, photo, degree, batch.',
        'Card displays verified graduate gold emblem.',
        'Alumnus clicks card or "Flip ID" button.',
        'Card executes 3D flip (rotateY 180deg) rendering reverse side.',
        'Reverse side renders QR code with verification URL, security clearance, and Lasallian motto.'
      ],
      altFlows: [
        'Unverified or suspended accounts show verification required warning overlay.'
      ],
      postconditions: 'High-fidelity collegiate credential presented.'
    },
    {
      id: 'UC-06',
      title: 'Publish, React & Moderate Campus Social Feed',
      actor: 'Alumni / Moderator / Administrator',
      scope: 'Community Social Feed Subsystem',
      preconditions: 'User has an active account.',
      trigger: 'User publishes milestone or interacts on Campus Feed.',
      normalFlow: [
        'User publishes post title, description, and optional photo.',
        'Post broadcasts to real-time feed and syncs to author profile view.',
        'Cecilians react with Heart; heart counter increments.',
        'Clicking heart counter opens Reactor Modal listing reacting members.',
        'Author can edit or delete their post from feed or profile tab.'
      ],
      altFlows: [
        'Author trying to heart own post triggers toast: "You cannot heart your own post."',
        'Moderator can delete inappropriate posts to maintain community decorum.'
      ],
      postconditions: 'Feed updated in real-time; author controls persisted.'
    },
    {
      id: 'UC-07',
      title: 'Search Verified Alumni Directory & Mutual Peer Connection',
      actor: 'Verified Alumni Member',
      scope: 'Directory & Networking Subsystem',
      preconditions: 'User is verified alumnus.',
      trigger: 'User opens Network Directory.',
      normalFlow: [
        'System applies privacy rules: unverified/pending accounts excluded; staff/admin hidden.',
        'User filters by degree program, graduation batch, or keyword search.',
        'User clicks "Connect" on peer card.',
        'Target alumnus receives request and accepts; mutual connection established.'
      ],
      altFlows: [
        'Unverified users encounter accreditation gate prompt.'
      ],
      postconditions: 'Connection stored; unlocks direct messaging between users.'
    },
    {
      id: 'UC-08',
      title: 'Gated Direct Messaging with Sticky Header',
      actor: 'Connected Alumni Member',
      scope: 'Peer Communications Subsystem',
      preconditions: 'Mutual connection exists (isConnected === true).',
      trigger: 'User clicks Message on connected peer card.',
      normalFlow: [
        'Chat opens with sticky header showing peer avatar, name, and degree.',
        'Chronological message history loaded.',
        'User composes and sends message.',
        'Message appended in real-time; push notification dispatched.'
      ],
      altFlows: [
        'Unconnected users see connection gate card; composer disabled.'
      ],
      postconditions: 'Thread preserved; header remains visible during scrolling.'
    },
    {
      id: 'UC-09',
      title: 'Corporate Accreditation & Job Posting Management',
      actor: 'Employer Partner',
      scope: 'Career Placement Subsystem',
      preconditions: 'Employer accesses portal via desktop web.',
      trigger: 'Corporate recruiter submits accreditation profile.',
      normalFlow: [
        'Recruiter inputs company profile and accreditation documents.',
        'Administrator approves partner status.',
        'Employer accesses Job Posting Studio.',
        'Employer publishes job title, qualifications, salary, and requirements.',
        'Opportunity published with verified partner badge.'
      ],
      altFlows: [
        'Mobile employer registration CTA disabled to preserve accreditation vetting.'
      ],
      postconditions: 'Job indexed for alumni applicants.'
    },
    {
      id: 'UC-10',
      title: 'Apply for Vacancy & Export Certified Collegiate PDF Resume',
      actor: 'Alumni Jobseeker',
      scope: 'Career Services & Document Export',
      preconditions: 'Alumnus has completed profile and verified degree standing.',
      trigger: 'Alumnus clicks Apply or Export Official Resume.',
      normalFlow: [
        'Alumnus clicks "Generate Certified PDF Resume".',
        'System compiles verified degree from masterlist, career, and contact info.',
        'Engine formats collegiate two-column PDF resume with college seal and verified watermark.',
        'In-app PDF preview modal rendered.',
        'Alumnus submits dossier to employer.'
      ],
      altFlows: [
        'Incomplete profile prompts quick completion before submission.'
      ],
      postconditions: 'Application submitted with certified credentials.'
    },
    {
      id: 'UC-11',
      title: 'Schedule Campus Events & Confirm RSVPs',
      actor: 'Institutional Moderator (Consolidated Staff Function)',
      scope: 'Events & Reunions Subsystem',
      preconditions: 'Actor has moderator or administrative privileges.',
      trigger: 'Moderator creates campus event or grand homecoming.',
      normalFlow: [
        'Moderator inputs title, date, venue, and attendee cap.',
        'Event published to campus calendar.',
        'Alumni click "RSVP: Going".',
        'Attendee list displays strictly confirmed guests (status: "going").',
        '24-hour reminder email and push alerts scheduled.'
      ],
      altFlows: [
        'Alumnus cancels RSVP; attendee counter decrements.'
      ],
      postconditions: 'Attendee roster accurately reflects confirmed guests.'
    },
    {
      id: 'UC-12',
      title: 'Broadcast Bulletins & Dispatch Web Push Alerts',
      actor: 'Institutional Moderator / Administrator',
      scope: 'Public Communications Subsystem',
      preconditions: 'Actor has announcement privileges.',
      trigger: 'Moderator publishes campus notice or urgent advisory.',
      normalFlow: [
        'Moderator drafts circular with category, rich text, and photo banner.',
        'Moderator flags notice as Urgent or Pinned if critical.',
        'System renders circular with enhanced dark-mode surface contrast.',
        'VAPID Web Push broadcast sent to registered service workers.',
        'Alumni receive push notification and open detail advisory modal.'
      ],
      altFlows: [
        'Older notices can be archived to maintain clean bulletin board.'
      ],
      postconditions: 'Circular broadcasted; push metrics recorded.'
    },
    {
      id: 'UC-13',
      title: 'Superadministrator Governance & Deletion Guardrail',
      actor: 'Superadministrator (Root Authority)',
      scope: 'Enterprise Identity & Access Governance',
      preconditions: 'Authenticated user has role superadmin.',
      trigger: 'Superadmin manages administrative users.',
      normalFlow: [
        'Superadmin opens Administrative Users table.',
        'Superadmin can modify staff roles between moderator, admin, and superadmin.',
        'Delete button on administrative accounts rendered EXCLUSIVELY to Superadmin.',
        'Standard administrators cannot view or trigger delete buttons on administrative accounts.',
        'Superadmin confirms deletion; administrative record permanently purged.'
      ],
      altFlows: [
        'Standard admin calling delete API on admin rejected by server-side guards.'
      ],
      postconditions: 'Strict separation of powers enforced.'
    },
    {
      id: 'UC-14',
      title: 'Automated Account Restoration Daemon',
      actor: 'Automated Security Engine (System Daemon)',
      scope: 'Security Scheduler Subsystem',
      preconditions: 'Account is SUSPENDED with defined suspensionEndDate.',
      trigger: 'Background scheduler evaluates UTC timestamps.',
      normalFlow: [
        'Daemon queries accounts where accountStatus === "SUSPENDED".',
        'If currentTime >= suspensionEndDate and account is not permanently locked:',
        'State transitions to ACTIVE; autoRestored = true.',
        'Audit log records ACCOUNT_AUTO_RESTORED (NORMAL, no warning icon).',
        'User can sign in immediately.'
      ],
      altFlows: [
        'Permanently locked accounts (isPermanentLock = true) skipped; require manual admin unlock.'
      ],
      postconditions: 'Suspended account restored upon penalty expiration.'
    }
  ];

  const filteredNarratives = narratives.filter((n) => {
    const matchesSearch =
      n.id.toLowerCase().includes(narrativeSearch.toLowerCase()) ||
      n.title.toLowerCase().includes(narrativeSearch.toLowerCase()) ||
      n.actor.toLowerCase().includes(narrativeSearch.toLowerCase()) ||
      n.scope.toLowerCase().includes(narrativeSearch.toLowerCase());
    const matchesRole =
      narrativeRoleFilter === 'all' ||
      n.actor.toLowerCase().includes(narrativeRoleFilter.toLowerCase());
    return matchesSearch && matchesRole;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden text-stone-900 dark:text-stone-100">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4.5 border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8B181B] text-white flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white tracking-tight">
                  St. Cecilia's College Alumnet • System Documentation Suite
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  v2.6.0 Spec
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Use Case Narratives • Draw.io XML ERD • Scalable Vector Diagrams • Role Matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownload(useCaseDrawioXml, 'StCecilias_Alumnet_UseCase.drawio', 'application/xml')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
              title="Download Use Case Diagram (.drawio)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Use Case .drawio</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload(erdDrawioXml, 'StCecilias_Alumnet_ERD.drawio', 'application/xml')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
              title="Download ERD Diagram (.drawio)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ERD .drawio</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRIMARY NAVIGATION TABS */}
        <div className="px-6 py-2 border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-3 bg-white dark:bg-stone-900 overflow-x-auto">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('narratives')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'narratives'
                  ? 'bg-[#8B181B] text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Use Case Narratives ({narratives.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('usecase')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'usecase'
                  ? 'bg-[#8B181B] text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Use Case Diagram (SVG & XML)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('erd')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'erd'
                  ? 'bg-[#8B181B] text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>ERD in Draw.io XML</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'matrix'
                  ? 'bg-[#8B181B] text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Actors & Task Matrix</span>
            </button>
          </div>

          <div className="text-[11px] font-semibold text-stone-500 hidden md:block">
            Draw.io / diagrams.net Compliant
          </div>
        </div>

        {/* TAB 1: USE CASE NARRATIVES */}
        {activeTab === 'narratives' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-50 dark:bg-stone-800/40 p-3.5 rounded-2xl border border-stone-200/80 dark:border-stone-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={narrativeSearch}
                  onChange={(e) => setNarrativeSearch(e.target.value)}
                  placeholder="Search by Use Case ID, title, actor, or trigger..."
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white font-medium focus:outline-hidden focus:border-[#8B181B]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={narrativeRoleFilter}
                  onChange={(e) => setNarrativeRoleFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-700 dark:text-stone-200 font-semibold focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Roles & Actors</option>
                  <option value="alumni">Alumni Member</option>
                  <option value="employer">Employer Partner</option>
                  <option value="moderator">Institutional Moderator</option>
                  <option value="admin">System Administrator</option>
                  <option value="superadmin">Superadministrator</option>
                  <option value="daemon">Security Daemon</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleCopy(JSON.stringify(narratives, null, 2), 'Use Case Narratives JSON')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer shrink-0"
                >
                  {copiedSection === 'Use Case Narratives JSON' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy JSON</span>
                </button>
              </div>
            </div>

            {/* Narratives List */}
            <div className="grid grid-cols-1 gap-4">
              {filteredNarratives.map((uc) => (
                <div
                  key={uc.id}
                  className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs p-5 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 text-xs font-mono font-bold bg-[#8B181B] text-white rounded-lg">
                        {uc.id}
                      </span>
                      <h3 className="text-base font-bold text-stone-900 dark:text-white">
                        {uc.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 rounded-md">
                        Actor: {uc.actor}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-stone-500 bg-stone-50 dark:bg-stone-850 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700">
                        {uc.scope}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                    <div className="p-3 bg-stone-50/70 dark:bg-stone-800/40 rounded-xl border border-stone-100 dark:border-stone-800/80">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-stone-400 block mb-1">
                        Preconditions
                      </span>
                      <p className="text-stone-700 dark:text-stone-300">{uc.preconditions}</p>
                    </div>

                    <div className="p-3 bg-stone-50/70 dark:bg-stone-800/40 rounded-xl border border-stone-100 dark:border-stone-800/80">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-stone-400 block mb-1">
                        Trigger
                      </span>
                      <p className="text-stone-700 dark:text-stone-300">{uc.trigger}</p>
                    </div>
                  </div>

                  {/* Normal Flow */}
                  <div className="mt-3.5">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-stone-400 block mb-1.5">
                      Main Success Scenario (Normal Flow)
                    </span>
                    <ol className="space-y-1 text-xs text-stone-700 dark:text-stone-300 list-decimal list-inside bg-stone-50/40 dark:bg-stone-800/20 p-3 rounded-xl border border-stone-100 dark:border-stone-800">
                      {uc.normalFlow.map((step, idx) => (
                        <li key={idx} className="leading-relaxed">
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Alternative Flows / Extensions */}
                  <div className="mt-3">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-amber-600 dark:text-amber-400 block mb-1.5">
                      Extensions & Alternative Flows
                    </span>
                    <ul className="space-y-1 text-xs text-stone-600 dark:text-stone-300 list-disc list-inside bg-amber-50/40 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                      {uc.altFlows.map((alt, idx) => (
                        <li key={idx} className="leading-relaxed">
                          <span>{alt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500">
                    <span><strong>Postconditions:</strong> {uc.postconditions}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: USE CASE DIAGRAM (SVG & XML) */}
        {activeTab === 'usecase' && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between bg-stone-50 dark:bg-stone-800/40 p-3.5 rounded-2xl border border-stone-200/80 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseCaseViewMode('svg')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    useCaseViewMode === 'svg'
                      ? 'bg-[#8B181B] text-white shadow-2xs'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 inline mr-1" />
                  <span>Visual SVG Diagram</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUseCaseViewMode('xml')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    useCaseViewMode === 'xml'
                      ? 'bg-[#8B181B] text-white shadow-2xs'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 inline mr-1" />
                  <span>Draw.io XML Code</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(useCaseDrawioXml, 'Use Case Draw.io XML')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                >
                  {copiedSection === 'Use Case Draw.io XML' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy Draw.io XML</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(useCaseDrawioXml, 'StCecilias_Alumnet_UseCase.drawio', 'application/xml')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#8B181B] text-white hover:bg-[#721316] transition-colors cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .drawio</span>
                </button>
              </div>
            </div>

            {useCaseViewMode === 'svg' ? (
              <div className="flex-1 overflow-auto bg-stone-100 dark:bg-stone-950 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 flex items-center justify-center">
                <div className="max-w-5xl w-full bg-white dark:bg-stone-900 rounded-xl shadow-md p-4 border border-stone-200 dark:border-stone-800 overflow-auto max-h-[65vh]">
                  {/* Visual SVG Diagram rendered directly */}
                  <svg viewBox="0 0 1350 960" width="100%" height="auto" style={{ background: '#FAF9F6', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                    <defs>
                      <filter id="m_shadow" x="-5%" y="-5%" width="110%" height="110%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.06"/>
                      </filter>
                      <linearGradient id="m_primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#8B181B"/>
                        <stop offset="100%" stopColor="#6B1215"/>
                      </linearGradient>
                    </defs>

                    {/* SYSTEM BOUNDARY */}
                    <rect x="260" y="40" width="830" height="880" rx="20" fill="#FFFFFF" stroke="#8B181B" strokeWidth="2.5" filter="url(#m_shadow)"/>
                    <rect x="260" y="40" width="830" height="42" rx="20" fill="url(#m_primaryGrad)"/>
                    <text x="675" y="68" fill="#FFFFFF" fontSize="15" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">ST. CECILIA'S COLLEGE - CEBU, INC. ALUMNET SYSTEM BOUNDARY</text>

                    {/* ACTORS (LEFT SIDE) */}
                    <g transform="translate(60, 180)">
                      <circle cx="50" cy="30" r="16" fill="#FAF9F6" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="46" x2="50" y2="90" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="20" y1="62" x2="80" y2="62" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="90" x2="25" y2="130" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="90" x2="75" y2="130" stroke="#8B181B" strokeWidth="2.5"/>
                      <text x="50" y="152" fontSize="12" fontWeight="bold" fill="#1C1917" textAnchor="middle">Alumni Member</text>
                      <text x="50" y="167" fontSize="10" fill="#78716C" textAnchor="middle">Verified Graduate</text>
                    </g>

                    <g transform="translate(60, 520)">
                      <circle cx="50" cy="30" r="16" fill="#FAF9F6" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="46" x2="50" y2="90" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="20" y1="62" x2="80" y2="62" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="90" x2="25" y2="130" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="90" x2="75" y2="130" stroke="#8B181B" strokeWidth="2.5"/>
                      <text x="50" y="152" fontSize="12" fontWeight="bold" fill="#1C1917" textAnchor="middle">Employer Partner</text>
                      <text x="50" y="167" fontSize="10" fill="#78716C" textAnchor="middle">Corporate Recruiter</text>
                    </g>

                    {/* ACTORS (RIGHT SIDE) */}
                    <g transform="translate(1190, 160)">
                      <circle cx="50" cy="30" r="16" fill="#FAF9F6" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="46" x2="50" y2="90" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="20" y1="62" x2="80" y2="62" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="90" x2="25" y2="130" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="90" x2="75" y2="130" stroke="#8B181B" strokeWidth="2.5"/>
                      <text x="50" y="152" fontSize="12" fontWeight="bold" fill="#1C1917" textAnchor="middle">Institutional Moderator</text>
                      <text x="50" y="167" fontSize="10" fill="#78716C" textAnchor="middle">Registrar / Events / Circulars</text>
                    </g>

                    <g transform="translate(1190, 430)">
                      <circle cx="50" cy="30" r="16" fill="#FAF9F6" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="46" x2="50" y2="90" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="20" y1="62" x2="80" y2="62" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="90" x2="25" y2="130" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="90" x2="75" y2="130" stroke="#8B181B" strokeWidth="2.5"/>
                      <text x="50" y="152" fontSize="12" fontWeight="bold" fill="#1C1917" textAnchor="middle">System Administrator</text>
                      <text x="50" y="167" fontSize="10" fill="#78716C" textAnchor="middle">Security & Suspensions</text>
                    </g>

                    <g transform="translate(1190, 700)">
                      <circle cx="50" cy="30" r="16" fill="#FAF9F6" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="46" x2="50" y2="90" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="20" y1="62" x2="80" y2="62" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="90" x2="25" y2="130" stroke="#8B181B" strokeWidth="2.5"/>
                      <line x1="50" y1="90" x2="75" y2="130" stroke="#8B181B" strokeWidth="2.5"/>
                      <text x="50" y="152" fontSize="12" fontWeight="bold" fill="#1C1917" textAnchor="middle">Superadministrator</text>
                      <text x="50" y="167" fontSize="10" fill="#78716C" textAnchor="middle">Root Governance</text>
                    </g>

                    {/* USE CASE OVALS */}
                    <g>
                      <ellipse cx="430" cy="120" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="430" y="124" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-01: Authenticate via PBKDF2/Biometrics</text>
                    </g>
                    <g>
                      <ellipse cx="430" cy="200" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="430" y="204" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-05: Generate & Flip Digital Alumni ID</text>
                    </g>
                    <g>
                      <ellipse cx="430" cy="280" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="430" y="284" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-06: Publish & Heart Campus Feed Posts</text>
                    </g>
                    <g>
                      <ellipse cx="430" cy="360" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="430" y="364" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-07: Search Verified Alumni Directory</text>
                    </g>
                    <g>
                      <ellipse cx="430" cy="440" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="430" y="444" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-08: Gated Direct Messaging with Peer</text>
                    </g>
                    <g>
                      <ellipse cx="430" cy="520" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="430" y="524" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-10: Apply for Job & Export PDF Resume</text>
                    </g>

                    <g>
                      <ellipse cx="880" cy="120" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="880" y="124" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-04: Student Clearance & Degree Verification</text>
                    </g>
                    <g>
                      <ellipse cx="880" cy="200" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="880" y="204" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-11: Schedule Events & Confirm RSVPs</text>
                    </g>
                    <g>
                      <ellipse cx="880" cy="280" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="880" y="284" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-12: Broadcast Bulletins & Push Alerts</text>
                    </g>
                    <g>
                      <ellipse cx="880" cy="360" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="880" y="364" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-09: Corporate Accreditation & Job Posting</text>
                    </g>
                    <g>
                      <ellipse cx="880" cy="450" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="880" y="454" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-02: Security Audit Logs & Threat Detection</text>
                    </g>
                    <g>
                      <ellipse cx="880" cy="540" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="880" y="544" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-03: Account Suspension & Lock Scheduler</text>
                    </g>
                    <g>
                      <ellipse cx="880" cy="630" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="880" y="634" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-13: Superadmin Role & Deletion Guard</text>
                    </g>
                    <g>
                      <ellipse cx="880" cy="720" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" strokeWidth="1.8"/>
                      <text x="880" y="724" fontSize="11" fontWeight="600" fill="#1C1917" textAnchor="middle">UC-14: Automated Account Restoration Daemon</text>
                    </g>

                    {/* CONNECTORS */}
                    <line x1="130" y1="210" x2="305" y2="125" stroke="#78716C" strokeWidth="1.2"/>
                    <line x1="130" y1="220" x2="300" y2="200" stroke="#78716C" strokeWidth="1.2"/>
                    <line x1="130" y1="230" x2="300" y2="280" stroke="#78716C" strokeWidth="1.2"/>
                    <line x1="130" y1="240" x2="300" y2="360" stroke="#78716C" strokeWidth="1.2"/>
                    <line x1="130" y1="250" x2="300" y2="440" stroke="#78716C" strokeWidth="1.2"/>
                    <line x1="130" y1="260" x2="305" y2="515" stroke="#78716C" strokeWidth="1.2"/>

                    <line x1="130" y1="560" x2="745" y2="370" stroke="#78716C" strokeWidth="1.2"/>
                    <line x1="130" y1="580" x2="560" y2="525" stroke="#78716C" strokeWidth="1.2"/>

                    <line x1="1200" y1="210" x2="1020" y2="125" stroke="#78716C" strokeWidth="1.2"/>
                    <line x1="1200" y1="220" x2="1020" y2="200" stroke="#78716C" strokeWidth="1.2"/>
                    <line x1="1200" y1="230" x2="1020" y2="280" stroke="#78716C" strokeWidth="1.2"/>
                    <line x1="1200" y1="240" x2="560" y2="280" stroke="#78716C" strokeWidth="1.2"/>

                    <line x1="1200" y1="480" x2="1020" y2="455" stroke="#78716C" strokeWidth="1.2"/>
                    <line x1="1200" y1="490" x2="1020" y2="540" stroke="#78716C" strokeWidth="1.2"/>

                    <line x1="1200" y1="750" x2="1020" y2="635" stroke="#78716C" strokeWidth="1.2"/>
                    <path d="M 1240 690 L 1240 590" stroke="#8B181B" strokeWidth="1.8" strokeDasharray="4,4"/>
                    <polygon points="1240,580 1234,592 1246,592" fill="#8B181B"/>

                    <text x="675" y="900" fontSize="11" fill="#A8A29E" textAnchor="middle">St. Cecilia's College - Cebu, Inc. • Lasallian Affiliate Member</text>
                  </svg>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto bg-stone-900 text-stone-100 rounded-2xl p-4 font-mono text-xs leading-relaxed border border-stone-800">
                <pre>{useCaseDrawioXml}</pre>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ERD IN DRAW.IO XML */}
        {activeTab === 'erd' && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between bg-stone-50 dark:bg-stone-800/40 p-3.5 rounded-2xl border border-stone-200/80 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  Relational Entity-Relationship Diagram (14 Core Tables)
                </span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 px-2 py-0.5 rounded font-bold">
                  Draw.io XML
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(erdDrawioXml, 'ERD Draw.io XML')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                >
                  {copiedSection === 'ERD Draw.io XML' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy ERD XML</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(erdDrawioXml, 'StCecilias_Alumnet_ERD.drawio', 'application/xml')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#8B181B] text-white hover:bg-[#721316] transition-colors cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ERD .drawio</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-stone-900 text-stone-100 rounded-2xl p-4 font-mono text-xs leading-relaxed border border-stone-800">
              <pre>{erdDrawioXml}</pre>
            </div>
          </div>
        )}

        {/* TAB 4: ACTORS & TASK MATRIX */}
        {activeTab === 'matrix' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="bg-stone-50 dark:bg-stone-800/40 p-4 rounded-2xl border border-stone-200 dark:border-stone-800">
              <h3 className="text-sm font-bold text-stone-900 dark:text-white mb-1">
                Institutional Role Consolidation & Authority Matrix
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Staff, Faculty, and Registrar work streams are completely consolidated into the Institutional Moderator role.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#8B181B] text-white font-bold">
                    <th className="py-3 px-4">User / Actor</th>
                    <th className="py-3 px-4">System Role Code</th>
                    <th className="py-3 px-4">Features & Functional Tasks</th>
                    <th className="py-3 px-4">Permissions & Access Bounds</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 bg-white dark:bg-stone-900">
                  <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                    <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white">Alumni Member</td>
                    <td className="py-3.5 px-4 font-mono text-[#8B181B] dark:text-red-400 font-bold">alumni</td>
                    <td className="py-3.5 px-4 text-stone-700 dark:text-stone-300">
                      • PBKDF2 / WebAuthn Biometric Login<br/>
                      • 3D Flippable Digital Alumni Card with QR<br/>
                      • Verified Alumni Directory search & peer networking<br/>
                      • Gated peer-to-peer messaging with sticky header<br/>
                      • Publish milestones, heart posts, edit/delete own posts<br/>
                      • Apply for jobs & generate certified collegiate PDF resume
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400">
                      Standard Alumni Member. Mobile App & Web Portal access enabled. Direct messaging gated to connected peers.
                    </td>
                  </tr>

                  <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                    <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white">Employer Partner</td>
                    <td className="py-3.5 px-4 font-mono text-blue-600 dark:text-blue-400 font-bold">employer</td>
                    <td className="py-3.5 px-4 text-stone-700 dark:text-stone-300">
                      • Corporate accreditation submission (Desktop Web)<br/>
                      • Post, edit, and close employment opportunities<br/>
                      • Review applicant dossiers & download certified resumes<br/>
                      • Message verified applicants directly
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400">
                      Employer Dashboard access. Mobile registration disabled to guarantee institutional vetting.
                    </td>
                  </tr>

                  <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/50 bg-emerald-50/20 dark:bg-emerald-950/10">
                    <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Institutional Moderator</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-700 dark:text-emerald-400 font-bold">moderator</td>
                    <td className="py-3.5 px-4 text-stone-700 dark:text-stone-300">
                      • <strong>Registrar Functions:</strong> Audit student masterlist, verify Student IDs, certify degree standings<br/>
                      • <strong>Staff Functions:</strong> Coordinate homecoming events, webinars, and confirmed guest RSVPs<br/>
                      • <strong>Communications:</strong> Publish official bulletins with dark mode contrast & push alerts<br/>
                      • <strong>Moderation:</strong> Delete inappropriate feed comments, curate campus gallery
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400">
                      Inherits all consolidated Registrar, Faculty, and Staff operational powers. Full access to registry and verification queues.
                    </td>
                  </tr>

                  <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                    <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white">System Administrator</td>
                    <td className="py-3.5 px-4 font-mono text-rose-700 dark:text-rose-400 font-bold">admin</td>
                    <td className="py-3.5 px-4 text-stone-700 dark:text-stone-300">
                      • Security & Audit Log monitoring with status badges<br/>
                      • Investigate MULTIPLE_USERS_SAME_ACCOUNT alerts<br/>
                      • Execute Account Suspension Scheduler with mandatory reasons<br/>
                      • Permanent lockout and early account unlock<br/>
                      • Approve employer accreditation
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400">
                      System administrator powers. Protected: Cannot delete peer admin or superadmin accounts.
                    </td>
                  </tr>

                  <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                    <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white">Superadministrator</td>
                    <td className="py-3.5 px-4 font-mono text-purple-700 dark:text-purple-400 font-bold">superadmin</td>
                    <td className="py-3.5 px-4 text-stone-700 dark:text-stone-300">
                      • All Administrator and Moderator capabilities<br/>
                      • Modify staff roles (moderator, admin, superadmin)<br/>
                      • Exclusive permission to permanently delete administrator accounts<br/>
                      • Database backup & root governance configuration
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400">
                      Root System Authority. Supreme governance over administrative records.
                    </td>
                  </tr>

                  <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                    <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white">Security Daemon</td>
                    <td className="py-3.5 px-4 font-mono text-stone-600 dark:text-stone-400 font-bold">System Engine</td>
                    <td className="py-3.5 px-4 text-stone-700 dark:text-stone-300">
                      • Evaluate concurrent active sessions for account sharing<br/>
                      • Flag MULTIPLE_USERS_SAME_ACCOUNT (SUSPICIOUS status, ⚠️ Yes)<br/>
                      • Enforce brute-force lockouts on 5 failed logins<br/>
                      • Evaluate scheduled suspension end dates and auto-restore accounts
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400">
                      Automated autonomous background engine.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-900/80 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Specification synced with docs/SYSTEM_DOCUMENTATION.md</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
            >
              Close Viewer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
