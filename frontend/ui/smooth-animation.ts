import {useInView} from 'motion/react';
import type {RefObject} from 'react';
export const SPRING_DEFAULT={type:'spring' as const,stiffness:300,damping:30};
export const SPRING_SNAPPY={type:'spring' as const,stiffness:450,damping:35};
export const DURATION_INSTANT={duration:0};
export const EASE_IN_OUT='easeInOut' as const;
export const LOOP_CLASS='motion-reduce:animate-none';
export const LOOP_REPEAT_DELAY={shimmer:.4};
export const loopTransition=(options:object,delay:number)=>({...options,repeat:Infinity,repeatDelay:delay});
export function useLoopInView(ref:RefObject<HTMLElement|null>){return useInView(ref);}
