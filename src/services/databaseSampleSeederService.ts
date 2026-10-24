/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeBatch, doc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db, FIRESTORE_COLLECTIONS } from '../lib/firebase';
import { AlumniEvent, Announcement, Opportunity, InstitutionalFeedPost, GalleryItem } from '../types';

export interface SeederProgress {
  featureName: string;
  completed: number;
  total: number;
  percent: number;
  isDone?: boolean;
}

/**
 * Curated authentic asset pools for St. Cecilia's College - Cebu, Inc.
 */
const EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80'
];

const ANNOUNCEMENT_IMAGES = [
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1562774053-701939374585?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80'
];

const GALLERY_IMAGES = [
  'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1562774053-701939374585?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1525921429624-479b6a26d84d?w=1200&auto=format&fit=crop&q=80'
];

const FEED_IMAGES = [
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&auto=format&fit=crop&q=80'
];

/**
 * 1. Generate 50 authentic Events
 */
export function generate50SampleEvents(): AlumniEvent[] {
  const eventTypes: Array<'reunion' | 'workshop' | 'networking' | 'webinar' | 'social'> = [
    'reunion', 'workshop', 'networking', 'webinar', 'social'
  ];

  const locations = [
    'Executive Quadrangle, SCC Main Campus, Minglanilla, Cebu',
    'Centennial Auditorium, St. Cecilia\'s College Complex',
    'CCS Innovation Lab & Server Hall, Ward II, Minglanilla',
    'Cebu I.T. Park Conference Center, Lahug, Cebu City',
    'Radisson Blu Ballroom, North Reclamation Area, Cebu City',
    'Virtual Stream via Cecilian Alumni Portal Live Hub',
    'San Cecilio Sports Complex & Field, Minglanilla',
    'Waterfront Cebu City Hotel & Casino, Lahug, Cebu City',
    'Marco Polo Plaza Grand Hall, Nivel Hills, Cebu City',
    'St. Cecilia\'s High School Gymnasium & Multi-purpose Arena'
  ];

  const titles = [
    'Grand Cecilian Centennial Alumni Homecoming 2026',
    'CCS Tech Innovation & Distributed Cloud Systems Summit',
    'Cecilian Alumni Career Mentorship & Leadership Roundtable',
    'Annual Cecilian Run for Education (5K / 10K Charity Marathon)',
    'College of Computer Studies AI & Microservices Bootcamp',
    'San Cecilio Feast Day Jubilee Gala & Alumni Night',
    'School of Business Alumni Entrepreneurship Pitchfest',
    'Teacher Education Alumni Best Practices in EdTech Forum',
    'Cecilian Criminology Alumni Law Enforcement Symposium',
    'Young Alumni Mixer: Transitioning from Campus to Enterprise',
    'SCC Healthcare & Nursing Alumni Global Medical Mission',
    'Inter-Batch Cecilian Alumni Basketball Championship Cup',
    'Archival Heritage Unveiling: 25 Years of Cecilian Excellence',
    'Senior Alumni Golden Jubilee Luncheon & Honors Banquet',
    'Cloud Architecture & DevOps Masterclass for Cecilian Engineers',
    'Cecilian Women in Leadership & Executive Tech Panel',
    'SCC Alumni Golf Invitational for Scholar Endowment',
    'Fintech Innovations & Digital Payments Seminar with MetroCebu',
    'Alumni General Assembly & Platform Governance Election',
    'Regional Alumni Chapter Meet: Metro Manila & Overseas Cecilians',
    'Cecilian Research Colloquium: Sustainable Technologies in the Visayas',
    'Batch 2015 Ten-Year Reunion: Reminiscing Decades of Camaraderie',
    'Batch 2020 Five-Year Reunion: Post-Pandemic Trailblazers',
    'Cybersecurity & Network Defense Workshop with Industry Specialists',
    'Alumni Cultural Night: Cecilian Choir & Performing Arts Ensemble',
    'SCC Job Fair & Walk-in Interview Day with Premier Cebu Firms',
    'Alumni Continuing Professional Development (CPD) Forum',
    'Cecilian Volunteerism Drive: Coastal Cleanup & Mangrove Planting',
    'Mobile App Architecture & React Native Hands-On Workshop',
    'Inter-Batch E-Sports & Gaming Championship: Cecilian Shield',
    'SCC Registrar & Career Center Alumni Resume Clinic',
    'Alumni Wellness & Mental Health in the Tech Workplace',
    'Cecilian Founders Memorial Lecture: Dr. Emmanuel C. Salcedo',
    'Batch 2010 Quindecennial Reunion: Celebrating 15 Years of Impact',
    'Enterprise Kubernetes & Distributed Microservices Symposium',
    'School of Hospitality Management Wine & Dine Alumni Banquet',
    'Cecilian Alumni Legal Clinic & Intellectual Property Rights Workshop',
    'Annual Alumni Tree Planting at Camp 7 Protected Landscape',
    'SCC Alumni Overseas Workers & Global Expatriates Virtual Townhall',
    'Cecilian Data Science & Machine Learning Practical Lab',
    'Alumni Badminton & Volleyball Tournament at San Cecilio Gym',
    'Batch 2005 20th Anniversary Ruby Jubilee Homecoming Gathering',
    'Digital Transformation in Philippine Governance Seminar',
    'Cecilian Student-Alumni Peer Mentorship Kickoff Session',
    'SCC Alumni Chamber Choir 20th Anniversary Memorial Concert',
    'Alumni Career Shift Workshop: From BPO to Cloud Engineering',
    'St. Cecilia’s College Robotics & Hardware Maker Faire',
    'Inter-College Alumni Trivia & Quiz Bowl Night at Minglanilla',
    'Cecilian Alumni Medical & Dental Outreach for South Cebu Communities',
    'Year-End Cecilian Thanksgiving Mass & Executive Alumni Fellowship'
  ];

  return titles.map((title, idx) => {
    const eventType = eventTypes[idx % eventTypes.length];
    const isVirtual = idx % 5 === 0;
    const daysOffset = (idx - 15) * 5; // spans past, present, and upcoming
    const startDate = new Date(Date.now() + daysOffset * 86400000);
    const endDate = new Date(startDate.getTime() + 4 * 3600000);
    const imgUrl = EVENT_IMAGES[idx % EVENT_IMAGES.length];
    const location = isVirtual ? 'Virtual Stream via Cecilian Alumni Portal Live Hub' : locations[idx % locations.length];

    return {
      id: `live_evt_${Date.now()}_${String(idx + 1).padStart(2, '0')}`,
      title,
      description: `${title} brings together alumni, faculty, and graduating students of St. Cecilia’s College - Cebu, Inc. to collaborate, share professional milestones, and build institutional pride. Keynotes, networking circles, and recognition honors will be held.`,
      location,
      venue: location,
      tagline: `Official Cecilian institutional gathering — Class of 2000 to 2025 welcome.`,
      type: eventType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      date: startDate.toISOString().split('T')[0],
      startTime: '09:00 AM',
      endTime: '05:00 PM',
      heroImageUrl: imgUrl,
      eventImages: [imgUrl],
      isVirtual,
      isImportant: idx % 4 === 0,
      isFeaturedReservation: idx % 6 === 0,
      maxAttendees: 150 + (idx % 5) * 50,
      maxParticipants: 150 + (idx % 5) * 50,
      reservedSeatsCount: 20 + (idx % 12) * 5,
      attendeesCount: 35 + (idx % 20) * 4,
      createdBy: 'usr_superadmin_cecilia',
      createdByName: 'Dr. Emmanuel C. Salcedo',
      organizerId: 'usr_superadmin_cecilia',
      organizerName: 'St. Cecilia’s College Alumni Affairs & Directorate',
      likes: ['usr_superadmin_cecilia', 'usr_pocoraven_admin'],
      comments: [
        {
          id: `cmt_live_evt_${idx}_01`,
          authorId: 'usr_pocoraven_admin',
          authorName: 'Raven Lopez',
          authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
          text: 'Looking forward to seeing our fellow Cecilians and batchmates at this gathering!',
          createdAt: new Date().toISOString()
        }
      ],
      userRsvp: idx % 3 === 0 ? 'going' : (idx % 4 === 0 ? 'interested' : null)
    };
  });
}

/**
 * 2. Generate 50 authentic Announcements
 */
export function generate50SampleAnnouncements(): Announcement[] {
  const categories = ['institutional', 'academic', 'career', 'campus', 'reunion', 'department'];

  const titles = [
    'CHED Reaccredits St. Cecilia’s College BSIT Program as Center of Development',
    'Inauguration of the Centennial Digital Archives and Alumni Innovation Lounge',
    '2026 Cecilian Global Alumni Endowment Fund Open for Project Grants',
    'Official Guidelines for the Grand Centennial Alumni Homecoming 2026',
    'College of Computer Studies Inaugurates Cloud & Virtualization Server Bay',
    'Call for Nominations: Outstanding Cecilian Alumni Awards 2026',
    'SCC Registrar Announces Fast-Track Alumni Transcript & Verification Portal',
    'Partnership Inked with MetroCebu InnovateCorp for Guaranteed BSIT Internships',
    'San Cecilio Sports Arena Renovation Nearing Completion for Alumni Cup',
    'Alumni ID Online Card Printing & QR Validation System Now Active',
    'School of Business Earns 100% Passing Rate in National Certified Bookkeeper Exam',
    'Notice of Annual General Alumni Association Executive Board Elections',
    'Cecilian Relief Operations: South Cebu Community Outreach Mission Completed',
    'SCC Library Adds IEEE Xplore & ACM Digital Library Access for Registered Alumni',
    'Dr. Emmanuel C. Salcedo Delivers State of the College Executive Address',
    'College of Education Cecilian Graduates Clinch Top 10 in Regional Licensure Exam',
    'New Career Center Portal Launched: Bridging Cecilians with Visayas Employers',
    'Alumni Mentorship Program 2026: Sign Up as a Mentor for Graduating Seniors',
    'Advisory on Registrar Record Harmonization & Identity Safeguard Protocols',
    'Cecilian Choir Wins Grand Prize at Cebu Inter-Collegiate Choral Festival',
    'Campus Parking & Access Protocol Updates for Upcoming Alumni Gathering',
    'SCC Platform Directorate Deploys Real-Time Firebase Sync Engine for Registry',
    'Scholarship Endowment Fund Surpasses PHP 2.5 Million Milestone in Donations',
    'Criminology Department Hosts Forensic Science Demonstration for Alumni Officers',
    'Batch 2023 Digital Yearbook Archive Now Searchable via Student Portal',
    'Advisory on Safe Online Job Applications and Fraud Prevention for Alumni',
    'College of Nursing Achieves High Passing Rate in Philippine Nursing Licensure',
    'Cecilian Technologists Guild Hosts Annual Open-Source Hackathon for South Cebu',
    'Executive Directive: Free Campus Facility Access for Verified Alumni Chapters',
    'St. Cecilia’s College Celebrates 26 Years of Quality Higher Education & Values',
    'SCC Alumni Chamber Launches Discount Privilege Network with Local Merchants',
    'Advisory: Mandatory Biometric Verification Setup for Admin Operations',
    'Campus Botanical Gardens Renovation Dedicated in Honor of Founding Educators',
    'Call for Submissions: Cecilian Alumni Research Journal Volume 12',
    'Alumni Basketball League Registration Open for Batches 2005 through 2024',
    'SCC Guidance Office Launches Free Tele-Counseling Consultations for Alumni',
    'Batch 2018 Donates 30 High-Spec Workstations to Information Technology Lab',
    'Notice: Registrar Window Hours During College Commencement Week',
    'SCC Computer Society Partners with AWS User Group Cebu for Tech Series',
    'Alumni Overseas Chapter in Singapore & Dubai Hold Joint Fellowship Assembly',
    'Advisory on Official Graduation Verification Format for Employers & Consulates',
    'Cecilian Environmental Club Leads Mangrove Reforestation in Talisay Coastal Area',
    'Teacher Education Alumni Best Practices Journal Now Available for Download',
    'Executive Board Approves Special Fee Discounts for Children of Cecilian Alumni',
    'SCC Innovation Pavilion Welcomes 15 Startup Incubators Led by Alumni Founders',
    'Graduating Batch of 2026 Transition Roadmap: Welcoming the Newest Cecilians',
    'Alumni Blood Donation Drive in Cooperation with Philippine Red Cross Cebu',
    'SCC Platform Infrastructure Update: Enhanced Cloud Security & Data Integrity',
    'Annual Golden Heart Award Nominations for Community Leadership Open',
    'Thanksgiving Message from the Executive Complex for a Historic Academic Year'
  ];

  return titles.map((title, idx) => {
    const category = categories[idx % categories.length];
    const isImportant = idx % 4 === 0;
    const daysOffset = -1 * idx * 3;
    const pubDate = new Date(Date.now() + daysOffset * 86400000).toISOString();
    const imgUrl = ANNOUNCEMENT_IMAGES[idx % ANNOUNCEMENT_IMAGES.length];

    return {
      id: `live_ann_${Date.now()}_${String(idx + 1).padStart(2, '0')}`,
      title,
      content: `${title}. St. Cecilia’s College - Cebu, Inc. announces this institutional bulletin for all alumni, faculty, and academic stakeholders. The Office of the President and Alumni Directorate ensure that our community stays informed, engaged, and united in academic excellence and service.`,
      important: isImportant,
      urgent: idx % 10 === 0,
      isPinned: idx < 3,
      category,
      publishedAt: pubDate,
      createdAt: pubDate,
      createdBy: 'usr_superadmin_cecilia',
      authorId: 'usr_superadmin_cecilia',
      authorName: 'Dr. Emmanuel C. Salcedo',
      authorRole: 'Superadministrator & President',
      imageUrl: imgUrl,
      likes: 15 + (idx % 25) * 3,
      hearts: ['usr_superadmin_cecilia', 'usr_pocoraven_admin'],
      commentsCount: 2 + (idx % 8),
      pinned: idx < 3,
      views: 85 + idx * 12
    };
  });
}

/**
 * 3. Generate 50 authentic Career Opportunities
 */
export function generate50SampleOpportunities(): Opportunity[] {
  const jobTypes: Array<'Full-time' | 'Part-time' | 'Internship' | 'Contract' | 'Mentorship'> = [
    'Full-time', 'Full-time', 'Full-time', 'Contract', 'Part-time', 'Internship'
  ];

  const companies = [
    'Archipelagic Cloud Systems',
    'MetroCebu InnovateCorp',
    'Visayas Fintech Labs',
    'St. Cecilia’s Platform Systems',
    'Cebu Software Dynamics',
    'Sugbo Logistics & Tech Solutions',
    'South Cebu IT Park Enterprises',
    'Mandaue Digital Systems',
    'Archipelago Cyber Defense Corp',
    'Lexmark Research and Development Cebu',
    'NCR Voyix Cebu Development Center',
    'Qualfon Philippines IT Operations'
  ];

  const locations = [
    'Cebu I.T. Park, Lahug, Cebu City',
    'Cebu Business Park, Cebu City',
    'Minglanilla Tech Hub, Cebu',
    'Mandaue City, Cebu',
    'Remote (Philippines)',
    'Hybrid (Cebu City / Home)',
    'Talisay City, Cebu'
  ];

  const jobRoles = [
    { title: 'Lead Full-Stack Cloud Architect', salary: 'PHP 120,000 - 160,000 / mo', course: 'BS in Information Technology', exp: '3–5 years' },
    { title: 'Associate Cybersecurity Analyst', salary: 'PHP 45,000 - 65,000 / mo', course: 'BS in Information Technology', exp: 'Fresh Graduate / 0-2 yrs' },
    { title: 'Enterprise UI/UX Systems Designer', salary: 'PHP 70,000 - 95,000 / mo', course: 'BS in Computer Science', exp: '2–4 years' },
    { title: 'Institutional Data Governance Specialist', salary: 'PHP 55,000 - 75,000 / mo', course: 'BS in Information Technology', exp: '1–3 years' },
    { title: 'DevOps & Kubernetes Infrastructure Engineer', salary: 'PHP 90,000 - 130,000 / mo', course: 'BS in Information Technology', exp: '2–5 years' },
    { title: 'Junior React & TypeScript Developer', salary: 'PHP 35,000 - 48,000 / mo', course: 'BS in Information Technology', exp: 'Fresh Graduate' },
    { title: 'Senior Backend Go & Node.js Engineer', salary: 'PHP 110,000 - 150,000 / mo', course: 'BS in Computer Science', exp: '4+ years' },
    { title: 'IT Systems Support Specialist', salary: 'PHP 28,000 - 38,000 / mo', course: 'BS in Information Technology', exp: '0–2 years' },
    { title: 'Quality Assurance & Test Automation Engineer', salary: 'PHP 50,000 - 70,000 / mo', course: 'BS in Computer Science', exp: '1–3 years' },
    { title: 'Business Process Analyst & Scrum Master', salary: 'PHP 60,000 - 85,000 / mo', course: 'BS in Business Administration', exp: '2–4 years' },
    { title: 'Corporate Financial Accountant', salary: 'PHP 40,000 - 55,000 / mo', course: 'BS in Business Administration', exp: '1–3 years' },
    { title: 'Secondary Computer Science Teacher', salary: 'PHP 30,000 - 42,000 / mo', course: 'Bachelor of Secondary Education', exp: 'Licensed / Fresh Grad' },
    { title: 'Database Administrator (PostgreSQL & Cloud SQL)', salary: 'PHP 80,000 - 110,000 / mo', course: 'BS in Information Technology', exp: '3–5 years' },
    { title: 'Mobile Applications Engineer (Flutter / React Native)', salary: 'PHP 65,000 - 90,000 / mo', course: 'BS in Information Technology', exp: '2–4 years' },
    { title: 'Digital Marketing & Content Lead', salary: 'PHP 38,000 - 52,000 / mo', course: 'BS in Business Administration', exp: '1–3 years' },
    { title: 'Network Infrastructure & Cisco Engineer', salary: 'PHP 50,000 - 72,000 / mo', course: 'BS in Information Technology', exp: '2–4 years' },
    { title: 'Information Security Compliance Officer', salary: 'PHP 75,000 - 105,000 / mo', course: 'BS in Information Technology', exp: '3–5 years' },
    { title: 'Human Resources Talent Acquisition Specialist', salary: 'PHP 32,000 - 45,000 / mo', course: 'BS in Business Administration', exp: '1–3 years' },
    { title: 'Cloud Solutions Consultant (GCP & AWS)', salary: 'PHP 95,000 - 135,000 / mo', course: 'BS in Information Technology', exp: '3–5 years' },
    { title: 'AI & Machine Learning Research Associate', salary: 'PHP 70,000 - 100,000 / mo', course: 'BS in Computer Science', exp: '1–3 years' },
    { title: 'Technical Writer & Systems Documentation Specialist', salary: 'PHP 36,000 - 48,000 / mo', course: 'Bachelor of Secondary Education', exp: '0–2 years' },
    { title: 'Site Reliability Engineer (SRE)', salary: 'PHP 85,000 - 120,000 / mo', course: 'BS in Information Technology', exp: '2–4 years' },
    { title: 'Healthcare Systems Software Engineer', salary: 'PHP 60,000 - 85,000 / mo', course: 'BS in Information Technology', exp: '1–3 years' },
    { title: 'E-Commerce Logistics Operations Manager', salary: 'PHP 50,000 - 70,000 / mo', course: 'BS in Business Administration', exp: '2–4 years' },
    { title: 'Graphic & Digital Media Designer', salary: 'PHP 32,000 - 45,000 / mo', course: 'BS in Computer Science', exp: '0–2 years' }
  ];

  const results: Opportunity[] = [];

  for (let i = 0; i < 50; i++) {
    const role = jobRoles[i % jobRoles.length];
    const company = companies[i % companies.length];
    const loc = locations[i % locations.length];
    const jobType = jobTypes[i % jobTypes.length];
    const daysOffset = -1 * (i % 25);
    const postDate = new Date(Date.now() + daysOffset * 86400000).toISOString();
    const deadline = new Date(Date.now() + (30 + (i % 30)) * 86400000).toISOString();

    results.push({
      id: `live_opp_${Date.now()}_${String(i + 1).padStart(2, '0')}`,
      title: i >= jobRoles.length ? `Senior ${role.title}` : role.title,
      type: jobType,
      employmentType: jobType,
      company,
      location: loc,
      description: `${company} is actively recruiting for a ${role.title} to join their Cebu operations. St. Cecilia's College graduates and alumni with a degree in ${role.course} are highly encouraged to apply. Key duties include designing scalable solutions, cross-functional collaboration, and applying best practices in modern engineering and institutional workflows.`,
      salaryOrStipend: role.salary,
      skills: ['TypeScript', 'Cloud Infrastructure', 'Team Leadership', 'Problem Solving', 'Git'],
      requirements: [
        `Graduated from an accredited program (${role.course} preferred)`,
        `Demonstrated experience level: ${role.exp}`,
        'Strong verbal and written communication skills',
        'Commitment to professional ethics and team collaboration'
      ],
      applicationUrl: 'https://careers.stcecilia.edu.ph',
      contactEmail: `careers@${company.toLowerCase().replace(/[^a-z]/g, '')}.ph`,
      postedBy: 'usr_employer_cecilia',
      postedByUid: 'usr_employer_cecilia',
      posterName: 'MetroCebu Hiring Team',
      postedByName: 'MetroCebu Hiring Team',
      posterRole: 'employer',
      createdAt: postDate,
      postedAt: postDate,
      status: 'active',
      approvalStatus: 'approved',
      requiredCourse: role.course,
      experienceLevel: role.exp,
      applicationDeadline: deadline,
      deadline,
      howToApply: 'both',
      applicationsCount: 2 + (i % 9)
    });
  }

  return results;
}

/**
 * 4. Generate 50 authentic Institutional Feed Posts
 */
export function generate50SampleFeedPosts(): InstitutionalFeedPost[] {
  const postTypes: Array<'milestone' | 'gallery' | 'announcement'> = ['milestone', 'gallery', 'announcement'];

  const postTemplates = [
    { title: 'Celebrating 26 Years of Cecilian Heritage & Academic Radiance', content: 'From our humble pioneer classes in Minglanilla to thousands of alumni serving worldwide, St. Cecilia’s College continues to forge character, competence, and service. Congratulations to all Cecilians!' },
    { title: 'College of Computer Studies Wins Gold at Regional IT Congress', content: 'Our BSIT student-alumni collaborative team presented their distributed cloud architecture project and clinched the top award among 24 colleges in the Visayas. Proud Cecilians!' },
    { title: 'Dr. Emmanuel C. Salcedo Welcomes Class of 2026 into Alumni Fold', content: 'A memorable evening at the Executive Quadrangle. Our soon-to-be graduates received their official Cecilian Alumni pins and recited the pledge of institutional integrity.' },
    { title: 'San Cecilio Chapel Bell Tower Renovated to Preserve Historic Legacy', content: 'The iconic bell tower standing tall in Ward II, Minglanilla has been restored to its historic grandeur, symbolizing our enduring faith and guiding light for every alumnus.' },
    { title: 'Alumni Mentorship Circle Launches with 50 Tech & Business Executives', content: 'Generous Cecilian alumni leaders return to campus to offer 1-on-1 career coaching, resume audits, and enterprise networking for graduating scholars.' },
    { title: 'Campus Spring Photo Highlights: The Quadrangle in Full Bloom', content: 'Golden afternoon sunlight over the St. Cecilia’s Executive Complex. Always a welcoming home whenever our graduates return to visit.' },
    { title: 'Cecilian Nursing & Healthcare Alumni Complete Medical Mission', content: 'Over 400 families in South Cebu received free health screenings and consultations through the volunteer service of our dedicated nursing graduates.' },
    { title: 'CCS Innovation Bay Upgraded with Dedicated Kubernetes Clusters', content: 'Alumni donations and industry partnerships have equipped our computer laboratories with enterprise-grade cloud compute instances.' },
    { title: 'School of Business Achieves Highest Employment Placement Rate in 5 Years', content: '94% of our 2024 business and accounting graduates secured gainful professional employment within six months of commencement. Remarkable work!' },
    { title: 'Alumni Basketball Cup 2026: Championship Matches Announced', content: 'Batches 2018 and 2022 will battle it out in the grand finals this Saturday at the San Cecilio Sports Arena. Come and support your batch!' }
  ];

  const results: InstitutionalFeedPost[] = [];

  for (let i = 0; i < 50; i++) {
    const template = postTemplates[i % postTemplates.length];
    const postType = postTypes[i % postTypes.length];
    const daysOffset = -1 * (i % 30);
    const postDate = new Date(Date.now() + daysOffset * 86400000).toISOString();
    const imgUrl = FEED_IMAGES[i % FEED_IMAGES.length];

    results.push({
      id: `live_post_${Date.now()}_${String(i + 1).padStart(2, '0')}`,
      authorId: 'usr_superadmin_cecilia',
      authorName: 'Dr. Emmanuel C. Salcedo',
      authorRole: 'admin',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      postType,
      title: i >= postTemplates.length ? `${template.title} (Part ${Math.floor(i / 10) + 1})` : template.title,
      content: template.content,
      imageUrl: imgUrl,
      milestoneBadge: postType === 'milestone' ? 'Cecilian Institutional Honor' : undefined,
      likes: ['usr_superadmin_cecilia', 'usr_pocoraven_admin', 'usr_alumni_cecilia_01'],
      hearts: ['usr_superadmin_cecilia', 'usr_pocoraven_admin'],
      comments: [
        {
          id: `cmt_feed_${i}_01`,
          authorId: 'usr_alumni_cecilia_01',
          authorName: 'Julian Marc S. Villareal',
          authorAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
          authorRole: 'alumni',
          text: 'Proud to be a Cecilian alumnus! Truly inspiring to see our alma mater continue to thrive.',
          createdAt: new Date().toISOString()
        }
      ],
      sharesCount: 5 + (i % 15),
      createdAt: postDate,
      isPinned: i === 0,
      tags: ['StCeciliasCollege', 'CecilianPride', 'AlumniNetwork', 'CebuEducation']
    });
  }

  return results;
}

/**
 * 5. Generate 50 authentic Campus Gallery Items
 */
export function generate50SampleGallery(): GalleryItem[] {
  const categories: Array<'campus' | 'homecoming' | 'commencement' | 'heritage'> = [
    'campus', 'homecoming', 'commencement', 'heritage'
  ];

  const galleryTitles = [
    'Executive Quadrangle & Fountain at Sunset',
    'Centennial Hall & Main Administration Building',
    'College of Computer Studies Distributed Systems Lab',
    'San Cecilio Chapel & Historical Cornerstone',
    'Grand Alumni Homecoming Commemorative Banquet',
    'Commencement Exercises at the Grand Auditorium',
    'Cecilian Choir Performance during Feast Day Mass',
    'San Cecilio Sports Arena & Gymnasium Court',
    'School of Business Simulated Boardroom Suite',
    'Science Laboratories & Molecular Research Center',
    'Alumni Torchlight Ceremony & Oath Taking',
    'Campus Heritage Library & Digital Archive Commons',
    'College Grounds & Botanical Walkway',
    'Inter-Batch Alumni Cup Awarding Ceremony',
    'Graduation Hooding Ceremony: Class of 2024',
    'Campus Aerial View over Minglanilla, Cebu',
    'Cecilian Student Council Leadership Summit',
    'Robotics and IoT Maker Bay in CCS Building',
    'Founders Day Carnival & Community Night',
    'Alumni Jubilarians Reception at Executive Pavilion',
    'School of Teacher Education Model Classroom',
    'San Cecilio Bell Tower Historic Landmark',
    'Alumni Career Fair Exhibitors & Partner Stalls',
    'Campus Cafeteria & Student Friendship Hall',
    'Cecilian Cultural Dancers at Sinulog Festival'
  ];

  const results: GalleryItem[] = [];

  for (let i = 0; i < 50; i++) {
    const title = galleryTitles[i % galleryTitles.length];
    const category = categories[i % categories.length];
    const year = String(2020 + (i % 6));
    const imgUrl = GALLERY_IMAGES[i % GALLERY_IMAGES.length];

    results.push({
      id: `live_gal_${Date.now()}_${String(i + 1).padStart(2, '0')}`,
      category,
      title: i >= galleryTitles.length ? `${title} (Archive Series ${Math.floor(i / 10) + 1})` : title,
      year,
      url: imgUrl,
      description: `Official photographic record of St. Cecilia’s College - Cebu, Inc. depicting ${title.toLowerCase()} from academic year ${year}.`,
      uploadedBy: 'usr_superadmin_cecilia',
      uploadedByName: 'Dr. Emmanuel C. Salcedo',
      uploaderRole: 'superadmin',
      createdAt: new Date(Date.now() - (i * 2) * 86400000).toISOString()
    });
  }

  return results;
}

/**
 * Execute Chunked Batch Writes into Firestore
 */
export async function populateAllCoreFeaturesSampleData(
  onProgress?: (progress: SeederProgress) => void
): Promise<{ success: boolean; totalWritten: number; summary: Record<string, number> }> {
  const events = generate50SampleEvents();
  const announcements = generate50SampleAnnouncements();
  const opportunities = generate50SampleOpportunities();
  const feedPosts = generate50SampleFeedPosts();
  const gallery = generate50SampleGallery();

  const totalItems = events.length + announcements.length + opportunities.length + feedPosts.length + gallery.length;
  let writtenCount = 0;

  const updateProgress = (name: string, count: number) => {
    writtenCount += count;
    if (onProgress) {
      onProgress({
        featureName: name,
        completed: writtenCount,
        total: totalItems,
        percent: Math.min(100, Math.round((writtenCount / totalItems) * 100))
      });
    }
  };

  const sanitize = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

  try {
    // 1. Events Batch (50 items)
    const eventBatch = writeBatch(db);
    events.forEach((evt) => {
      const ref = doc(db, FIRESTORE_COLLECTIONS.EVENTS, evt.id);
      eventBatch.set(ref, sanitize(evt), { merge: true });
    });
    await eventBatch.commit();
    updateProgress('Events (50 items)', events.length);

    // 2. Announcements Batch (50 items)
    const annBatch = writeBatch(db);
    announcements.forEach((ann) => {
      const ref = doc(db, FIRESTORE_COLLECTIONS.ANNOUNCEMENTS, ann.id);
      annBatch.set(ref, sanitize(ann), { merge: true });
    });
    await annBatch.commit();
    updateProgress('Announcements (50 items)', announcements.length);

    // 3. Opportunities Batch (50 items)
    const oppBatch = writeBatch(db);
    opportunities.forEach((opp) => {
      const ref = doc(db, FIRESTORE_COLLECTIONS.OPPORTUNITIES, opp.id);
      oppBatch.set(ref, sanitize(opp), { merge: true });
    });
    await oppBatch.commit();
    updateProgress('Career Opportunities (50 items)', opportunities.length);

    // 4. Feed Posts Batch (50 items)
    const feedBatch = writeBatch(db);
    feedPosts.forEach((post) => {
      const ref = doc(db, FIRESTORE_COLLECTIONS.FEED_POSTS, post.id);
      feedBatch.set(ref, sanitize(post), { merge: true });
    });
    await feedBatch.commit();
    updateProgress('Institutional Feed Posts (50 items)', feedPosts.length);

    // 5. Gallery Batch (50 items)
    const galBatch = writeBatch(db);
    gallery.forEach((item) => {
      const ref = doc(db, 'gallery', item.id);
      galBatch.set(ref, sanitize(item), { merge: true });
    });
    await galBatch.commit();
    updateProgress('Campus Gallery (50 items)', gallery.length);

    if (onProgress) {
      onProgress({
        featureName: 'All Collections Populated Successfully',
        completed: totalItems,
        total: totalItems,
        percent: 100,
        isDone: true
      });
    }

    return {
      success: true,
      totalWritten: totalItems,
      summary: {
        events: events.length,
        announcements: announcements.length,
        opportunities: opportunities.length,
        feedPosts: feedPosts.length,
        gallery: gallery.length
      }
    };
  } catch (error) {
    console.error('Failed to populate Firestore sample dataset:', error);
    throw error;
  }
}

/**
 * Selective Purge of Live Sample Data from Firestore
 */
export async function purgeFirestoreSampleData(
  onProgress?: (featureName: string, removedCount: number) => void
): Promise<{ success: boolean; totalPurged: number }> {
  let totalPurged = 0;

  const collectionsToClean = [
    { name: 'Events', collectionName: FIRESTORE_COLLECTIONS.EVENTS },
    { name: 'Announcements', collectionName: FIRESTORE_COLLECTIONS.ANNOUNCEMENTS },
    { name: 'Opportunities', collectionName: FIRESTORE_COLLECTIONS.OPPORTUNITIES },
    { name: 'Feed Posts', collectionName: FIRESTORE_COLLECTIONS.FEED_POSTS },
    { name: 'Gallery', collectionName: 'gallery' }
  ];

  for (const col of collectionsToClean) {
    try {
      const colRef = collection(db, col.collectionName);
      const snap = await getDocs(colRef);
      const sampleDocs = snap.docs.filter((d) => d.id.startsWith('live_'));

      for (const d of sampleDocs) {
        await deleteDoc(d.ref);
        totalPurged++;
      }

      if (onProgress) {
        onProgress(col.name, sampleDocs.length);
      }
    } catch (err) {
      console.warn(`Purge warning for ${col.name}:`, err);
    }
  }

  return { success: true, totalPurged };
}
