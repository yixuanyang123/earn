import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';

import {
  type MainSkills,
  SkillList,
  type SubSkillsType,
} from '@/interface/skills';
import { prisma } from '@/prisma';

const uniqueArray = (arr: SubSkillsType[]): SubSkillsType[] => {
  return Array.from(new Set(arr));
};

const correctSkills = (
  skillObjArray: { skills: MainSkills; subskills: SubSkillsType[] }[],
): { skills: MainSkills; subskills: SubSkillsType[] }[] => {
  const correctedSkills: { skills: MainSkills; subskills: SubSkillsType[] }[] =
    [];
  const skillMap: Record<MainSkills, SubSkillsType[]> = {} as Record<
    MainSkills,
    SubSkillsType[]
  >;

  skillObjArray.forEach((skillObj) => {
    if (!skillMap[skillObj.skills]) {
      skillMap[skillObj.skills] = [];
    }
    skillObj.subskills.forEach((subskill) => {
      const correctMainSkill = SkillList.find((s) =>
        s.subskills.includes(subskill),
      );

      if (correctMainSkill) {
        skillMap[correctMainSkill.mainskill].push(subskill);
      }
    });
  });

  Object.keys(skillMap).forEach((key) => {
    correctedSkills.push({
      skills: key as MainSkills,
      subskills: uniqueArray(skillMap[key as MainSkills]),
    });
  });

  return correctedSkills;
};

export default async function user(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = token.id;

  if (!userId) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  const { addUserSponsor, memberType, skills, ...updateAttributes } = req.body;
  let result;
  const correctedSkills = skills ? correctSkills(skills) : [];
  try {
    const updatedData = {
      ...updateAttributes,
      skills: correctedSkills,
    };

    result = await prisma.user.update({
      where: {
        id: userId as string,
      },
      data: updatedData,
      include: {
        currentSponsor: true,
      },
    });

    if (addUserSponsor && updateAttributes?.currentSponsorId) {
      await prisma.userSponsors.create({
        data: {
          userId: userId as string,
          sponsorId: updateAttributes?.currentSponsorId,
          role: memberType,
        },
      });
    }
    return res.status(200).json(result);
  } catch (e) {
    console.log('file: update.ts:93 ~ user ~ e:', e);
    return res.status(400).json({
      message: `Error occurred while updating user ${userId}.`,
    });
  }
}
