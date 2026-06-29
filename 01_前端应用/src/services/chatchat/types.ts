export interface CopyTags {
  mood?: string[];
  scene?: string[];
  style?: string[];
  purpose?: string[];
  theme?: string[];
  relation?: string;
  tone_level?: number;
  keywords?: string[];
}

export interface CorpusCopy {
  id: number;
  text: string;
  tags: CopyTags;
  tag_version?: string;
  qc_passed?: boolean;
  qc_errors?: string[];
  qc_warnings?: string[];
}

export interface MatchFilters {
  mood: string[];
  scene: string[];
  style: string[];
  purpose: string[];
  theme: string[];
  relation: string[];
  keywords: string[];
  semantic_keywords: string[];
  avoid: string[];
}

export interface ScoredCopy {
  copy: CorpusCopy;
  score: number;
}

export interface MatchedCorpusCopy extends CorpusCopy {
  matchScore?: number;
  matchPercent?: number;
  tagPercent?: number;
  semanticPercent?: number;
  tagScore?: number;
  semanticScore?: number;
}

export interface QuizSelection {
  tags?: Record<string, string[]>;
}

export interface QuizStepOption {
  label: string;
  tags: Record<string, string[]>;
}

export interface QuizStep {
  id: string;
  title: string;
  required: boolean;
  skipLabel?: string;
  options: QuizStepOption[];
  /** 仅当某用途选项 key 匹配时显示（关系补充题） */
  showWhenPurposeKey?: string;
}
