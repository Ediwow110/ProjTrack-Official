import type { Transition, Variants } from "motion/react";

type Axis = "x" | "y";

const easeStandard: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const easeEmphasized: [number, number, number, number] = [0.16, 1, 0.3, 1];
const easeExit: [number, number, number, number] = [0.4, 0, 1, 1];

export const motionTokens = {
  duration: {
    fast: 0.16,
    base: 0.24,
    slow: 0.36,
    scenic: 0.52,
  },
  ease: {
    standard: easeStandard,
    emphasized: easeEmphasized,
    exit: easeExit,
  },
} as const;

function instantOr<T extends Transition>(reduced: boolean, transition: T): Transition {
  return reduced ? { duration: 0 } : transition;
}

export function fadeInVariants(reduced: boolean, delay = 0): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: instantOr(reduced, {
        duration: motionTokens.duration.base,
        delay,
        ease: motionTokens.ease.standard,
      }),
    },
    exit: {
      opacity: 0,
      transition: instantOr(reduced, {
        duration: motionTokens.duration.fast,
        ease: motionTokens.ease.exit,
      }),
    },
  };
}

export function fadeUpVariants(
  reduced: boolean,
  { delay = 0, distance = 18 }: { delay?: number; distance?: number } = {},
): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : distance },
    visible: {
      opacity: 1,
      y: 0,
      transition: instantOr(reduced, {
        duration: motionTokens.duration.base,
        delay,
        ease: motionTokens.ease.emphasized,
      }),
    },
    exit: {
      opacity: 0,
      y: reduced ? 0 : Math.max(6, distance / 2),
      transition: instantOr(reduced, {
        duration: motionTokens.duration.fast,
        ease: motionTokens.ease.exit,
      }),
    },
  };
}

export function scaleInVariants(
  reduced: boolean,
  { delay = 0, scale = 0.985 }: { delay?: number; scale?: number } = {},
): Variants {
  return {
    hidden: { opacity: 0, scale: reduced ? 1 : scale },
    visible: {
      opacity: 1,
      scale: 1,
      transition: instantOr(reduced, {
        duration: motionTokens.duration.slow,
        delay,
        ease: motionTokens.ease.emphasized,
      }),
    },
    exit: {
      opacity: 0,
      scale: reduced ? 1 : 0.99,
      transition: instantOr(reduced, {
        duration: motionTokens.duration.fast,
        ease: motionTokens.ease.exit,
      }),
    },
  };
}

export function slideInVariants(
  reduced: boolean,
  {
    axis = "x",
    delay = 0,
    distance = 24,
  }: { axis?: Axis; delay?: number; distance?: number } = {},
): Variants {
  const hiddenTransform = reduced ? 0 : distance;
  const hiddenOffset = axis === "x" ? { x: hiddenTransform } : { y: hiddenTransform };
  const exitOffset = axis === "x" ? { x: reduced ? 0 : distance / 2 } : { y: reduced ? 0 : distance / 2 };

  return {
    hidden: {
      opacity: 0,
      ...hiddenOffset,
    },
    visible: {
      opacity: 1,
      ...(axis === "x" ? { x: 0 } : { y: 0 }),
      transition: instantOr(reduced, {
        duration: motionTokens.duration.base,
        delay,
        ease: motionTokens.ease.emphasized,
      }),
    },
    exit: {
      opacity: 0,
      ...exitOffset,
      transition: instantOr(reduced, {
        duration: motionTokens.duration.fast,
        ease: motionTokens.ease.exit,
      }),
    },
  };
}

export function staggerContainer(
  reduced: boolean,
  {
    delayChildren = 0.04,
    staggerChildren = 0.08,
  }: { delayChildren?: number; staggerChildren?: number } = {},
): Variants {
  return {
    hidden: {},
    visible: {
      transition: reduced
        ? { duration: 0 }
        : {
            delayChildren,
            staggerChildren,
          },
    },
  };
}

export function springTransition(
  reduced: boolean,
  overrides: Partial<Transition> = {},
): Transition {
  if (reduced) return { duration: 0 };

  return {
    type: "spring",
    stiffness: 360,
    damping: 34,
    mass: 0.9,
    ...overrides,
  };
}
