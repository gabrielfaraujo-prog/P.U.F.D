

import { 
    BarChart2, Search, LoaderCircle, FileText, Gem, Swords, 
    GraduationCap, Shuffle, Megaphone,
    Globe, Instagram, Facebook, CheckCircle2, XCircle, Download,
    BotMessageSquare, Calendar, Pencil, Trash2, UploadCloud, UserRound, CalendarPlus, ClipboardList, Award,
    Lightbulb, ThumbsUp, MessageSquare, Share2, Link2, PieChart, Users2, TrendingUp, Heart, Eye,
    Briefcase, Target, CheckSquare, Youtube, Film,
    Building2, FileCheck2, KanbanSquare, Users, Paperclip, Send, Settings, MessageSquare as MessageSquareIconLucide,
    FlaskConical
} from 'lucide-react';

export const BarChartIcon = ({size = 40}) => <BarChart2 size={size} className="text-white" />;
export const SearchIcon = () => <Search size={20} />;
export const LoaderIcon = () => <LoaderCircle size={48} className="mx-auto animate-spin text-red-500" />;
export const SmallLoaderIcon = () => <LoaderCircle size={20} className="animate-spin" />;

// Card Icons
export const FileTextIcon = ({className="text-red-400"}) => <FileText size={28} className={className} />;
export const GemIcon = () => <Gem size={28} className="text-red-400" />;
export const SwordsIcon = () => <Swords size={28} className="text-red-400" />;
export const GraduationCapIcon = () => <GraduationCap size={28} className="text-red-400" />;
export const ShuffleIcon = () => <Shuffle size={28} className="text-red-400" />;
export const MegaphoneIcon = ({size = 28, className="text-red-400"}: {size?: number, className?: string}) => <Megaphone size={size} className={className} />;
export const LinkIcon = () => <Link2 size={28} className="text-red-400" />;
export const DownloadIcon = () => <Download size={20} />;
export const AwardIcon = () => <Award size={28} className="text-red-400" />;
export const LightbulbIcon = ({size = 28, className="text-red-400"}: {size?: number, className?: string}) => <Lightbulb size={size} className={className} />;
export const PieChartIcon = () => <PieChart size={28} className="text-red-400" />;
export const AudienceIcon = () => <Users2 size={28} className="text-red-400" />;
export const PerformanceIcon = () => <TrendingUp size={28} className="text-red-400" />;
export const PersonaCardIcon = () => <UserRound size={28} className="text-white" />;
export const ContentAnalysisIcon = () => <Lightbulb size={28} className="text-red-400" />;
export const EngagementIcon = () => <MessageSquare size={28} className="text-red-400" />;
export const FilmIcon = ({size = 28, className="text-red-400"}: {size?: number, className?: string}) => <Film size={size} className={className} />;

// New icons for interactive dashboard
export const BriefcaseIcon = () => <Briefcase size={20} className="text-red-400" />;
export const TargetIcon = () => <Target size={20} className="text-red-400" />;
export const CheckSquareIcon = () => <CheckSquare size={20} className="text-red-400" />;


// Social & Link Icons
export const GlobeIcon = () => <Globe size={20} className="text-gray-400 hover:text-red-400 transition-colors" />;
export const InstagramIcon = () => <Instagram size={20} className="text-gray-400 hover:text-red-400 transition-colors" />;
export const FacebookIcon = () => <Facebook size={20} className="text-gray-400 hover:text-red-400 transition-colors" />;
export const YouTubeIcon = () => <Youtube size={20} className="text-gray-400 hover:text-red-400 transition-colors" />;
export const TikTokIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-red-400 transition-colors">
        <path d="M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
        <path d="M12 12v5" />
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
    </svg>
);
export const CheckIcon = () => <CheckCircle2 size={16} className="text-green-500" />;
export const CrossIcon = () => <XCircle size={20} className="text-red-500" />;

// New icons for Social Media Planner
export const BotMessageSquareIcon = () => <BotMessageSquare size={20} className="text-white" />;
export const CalendarCardIcon = () => <Calendar size={28} className="text-red-400" />;
export const PencilIcon = () => <Pencil size={20} className="text-white" />;
export const Trash2Icon = () => <Trash2 size={16} />;
export const UploadCloudIcon = ({size = 20, className = "text-white"}: {size?: number, className?: string}) => <UploadCloud size={size} className={className} />;
export const UserRoundIcon = () => <UserRound size={28} className="text-red-400" />;
export const CalendarPlusIcon = ({size = 40}) => <CalendarPlus size={size} className="text-white" />;

// New icons for Social Media Analyzer
export const ClipboardListIcon = ({size = 40, className = "text-white"}: {size?: number, className?: string}) => <ClipboardList size={size} className={className} />;

// New icon for Persona Generator
export const PersonaIcon = ({size = 40}) => <UserRound size={size} className="text-white" />;

// Icons for data-driven analyzer
export const ThumbsUpIcon = () => <ThumbsUp size={16} className="text-gray-400" />;
export const MessageSquareIcon = () => <MessageSquare size={16} className="text-gray-400" />;
export const Share2Icon = () => <Share2 size={16} className="text-gray-400" />;
export const HeartIcon = () => <Heart size={20} className="text-red-400" />;
export const EyeIcon = () => <Eye size={20} className="text-red-400" />;

// Icons for Agency OS
export const AgencyOSIcon = ({size = 40}) => <KanbanSquare size={size} className="text-white" />;
export const BuildingIcon = () => <Building2 size={28} className="text-red-400" />;
export const FileCheckIcon = () => <FileCheck2 size={28} className="text-red-400" />;
export const TeamIcon = () => <Users size={28} className="text-red-400" />;
export const PaperclipIcon = ({size = 18, className="text-gray-400 hover:text-white"}) => <Paperclip size={size} className={className} />;
export const CommentIcon = () => <MessageSquareIconLucide size={18} className="text-gray-400" />;
export const SendIcon = () => <Send size={18} className="text-white" />;
export const SettingsIcon = ({size=20, className="text-white"}) => <Settings size={size} className={className}/>;

// Icon for Creative Lab
export const CreativeLabIcon = ({size = 40}) => <FlaskConical size={size} className="text-white" />;
