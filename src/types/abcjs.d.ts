declare module 'abcjs' {
  export interface ClickListenerEvent {
    complex?: any;
    midiPitches?: Array<{ pitch: number; durationInMeasures: number; volume: number }>;
    noteIndex?: number;
    measureIndex?: number;
    voiceIndex?: number;
    [key: string]: any;
  }

  export interface TuneObject {
    [key: string]: any;
  }

  export function renderAbc(
    target: string | HTMLElement,
    abc: string,
    params?: {
      responsive?: 'resize' | string;
      add_classes?: boolean;
      clickListener?: (
        abcelem: any,
        tuneNumber: number,
        classes: any,
        analysis: ClickListenerEvent,
        drag: any,
        mouseEvent?: MouseEvent
      ) => void;
      scale?: number;
      staffwidth?: number;
      wrap?: {
        minSpacing?: number;
        maxSpacing?: number;
        preferredMeasuresPerLine?: number;
      };
      [key: string]: any;
    }
  ): TuneObject[];
}
