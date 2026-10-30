import type { ComponentType } from "react";
import type { OnboardingStep } from "../steps";
import { BirthdayScreen } from "./BirthdayScreen";
import { CodeScreen } from "./CodeScreen";
import { CardScreen } from "./CardScreen";
import { FreeScreen } from "./FreeScreen";
import { InviteScreen } from "./InviteScreen";
import { NameStep } from "./NameStep";
import { PicksScreen } from "./PicksScreen";
import { PlanScreen } from "./PlanScreen";
import { SignUpScreen } from "./SignUpScreen";
import { WelcomeScreen } from "./WelcomeScreen";
import { WhereScreen } from "./WhereScreen";
import { YoursScreen } from "./YoursScreen";

/** The built screens. Every step has a screen now; the placeholder stays as the fallback. */
const SCREENS: Partial<Record<OnboardingStep, ComponentType>> = {
  welcome: WelcomeScreen,
  signup: SignUpScreen,
  code: CodeScreen,
  name: NameStep,
  birthday: BirthdayScreen,
  where: WhereScreen,
  picks: PicksScreen,
  free: FreeScreen,
  yours: YoursScreen,
  card: CardScreen,
  plan: PlanScreen,
  invite: InviteScreen,
};

export const screenFor = (step: OnboardingStep): ComponentType | undefined => SCREENS[step];
