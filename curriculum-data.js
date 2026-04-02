// @ts-check
(function(){
  'use strict';

  /**
   * @typedef {'Egypt'|'England'|'United States'|'France'} CurriculumCountry
   * @typedef {'high-school'|'university'} CurriculumLevel
   * @typedef {'syllabus'|'framework'|'catalog'|'guide'} CurriculumSourceType
   * @typedef {'functional-groups'|'reaction-mechanisms'|'iupac-naming'|'stereochemistry'|'aromatic-chemistry'|'spectroscopy'} LessonSlug
   * @typedef {{label:string,url:string,type:CurriculumSourceType}} CurriculumSource
   * @typedef {{title:string,lessonSlug?:LessonSlug}} CurriculumTopic
   * @typedef {{
   *   title:string,
   *   level:CurriculumLevel,
   *   country:CurriculumCountry,
   *   sources:readonly CurriculumSource[],
   *   topics:readonly (CurriculumTopic|string)[]
   * }} CurriculumEntry
   */

  /**
   * @param {string} label
   * @param {string} url
   * @param {CurriculumSourceType} type
   * @returns {CurriculumSource}
   */
  function source(label,url,type){
    return Object.freeze({label,url,type});
  }

  /**
   * @param {string} title
   * @param {LessonSlug} lessonSlug
   * @returns {CurriculumTopic}
   */
  function linkedTopic(title,lessonSlug){
    return Object.freeze({title,lessonSlug});
  }

  /** @type {readonly CurriculumEntry[]} */
  const entries=Object.freeze([
    Object.freeze({
      title:'Egypt High School',
      level:'high-school',
      country:'Egypt',
      sources:Object.freeze([
        source('Egypt high school organic chemistry outline','https://example.org/curricula/egypt-high-school-organic-chemistry','syllabus'),
        source('Egypt secondary chemistry reference','https://example.org/curricula/egypt-secondary-chemistry-reference','guide')
      ]),
      topics:Object.freeze([
        'Difference between organic and inorganic compounds',
        'Molecular formula and structural formula',
        'Isomerism',
        'Hydrocarbons',
        'Alkanes',
        'Alkenes',
        linkedTopic('Substitution reactions','reaction-mechanisms'),
        linkedTopic('Addition reactions','reaction-mechanisms'),
        'Cracking',
        'Polymerization',
        'Combustion'
      ])
    }),
    Object.freeze({
      title:'Egypt University',
      level:'university',
      country:'Egypt',
      sources:Object.freeze([
        source('Egypt university organic chemistry course map','https://example.org/curricula/egypt-university-organic-chemistry','catalog'),
        source('Egypt university chemistry department guide','https://example.org/curricula/egypt-university-chemistry-guide','guide')
      ]),
      topics:Object.freeze([
        'Structure and bonding',
        linkedTopic('Functional groups','functional-groups'),
        linkedTopic('Stereochemistry','stereochemistry'),
        'Hydrocarbons',
        'Alcohols and ethers',
        'Aldehydes and ketones',
        'Carboxylic acids and derivatives',
        linkedTopic('Aromatic compounds','aromatic-chemistry'),
        'Amines',
        linkedTopic('Reaction mechanisms','reaction-mechanisms'),
        'Identification of simple organic compounds'
      ])
    }),
    Object.freeze({
      title:'England High School',
      level:'high-school',
      country:'England',
      sources:Object.freeze([
        source('England high school organic chemistry outline','https://example.org/curricula/england-high-school-organic-chemistry','syllabus'),
        source('England post-16 chemistry framework','https://example.org/curricula/england-post16-chemistry-framework','framework')
      ]),
      topics:Object.freeze([
        'Introduction to organic chemistry',
        'Hydrocarbons',
        'Halogen compounds',
        'Alcohols',
        'Carbonyl compounds',
        'Carboxylic acids and derivatives',
        linkedTopic('Aromatic chemistry','aromatic-chemistry'),
        'Organic synthesis basics',
        linkedTopic('Spectroscopy basics','spectroscopy')
      ])
    }),
    Object.freeze({
      title:'England University',
      level:'university',
      country:'England',
      sources:Object.freeze([
        source('England university organic chemistry track','https://example.org/curricula/england-university-organic-chemistry','catalog'),
        source('England university chemistry handbook','https://example.org/curricula/england-university-chemistry-handbook','guide')
      ]),
      topics:Object.freeze([
        'Structure and bonding',
        linkedTopic('Stereochemistry','stereochemistry'),
        linkedTopic('SN1 and SN2','reaction-mechanisms'),
        linkedTopic('E1 and E2','reaction-mechanisms'),
        linkedTopic('Electrophilic addition','reaction-mechanisms'),
        linkedTopic('Aromatic chemistry','aromatic-chemistry'),
        'Carbonyl chemistry',
        'Organic synthesis',
        linkedTopic('Spectroscopy','spectroscopy')
      ])
    }),
    Object.freeze({
      title:'United States High School',
      level:'high-school',
      country:'United States',
      sources:Object.freeze([
        source('United States high school carbon chemistry outline','https://example.org/curricula/united-states-high-school-organic-chemistry','syllabus'),
        source('United States general chemistry bridge guide','https://example.org/curricula/united-states-general-chemistry-bridge','guide')
      ]),
      topics:Object.freeze([
        'Carbon compounds overview',
        linkedTopic('Functional groups overview','functional-groups'),
        'Organic molecules in general chemistry context',
        'Bonding and molecular structure basics',
        'Intro acid-base ideas relevant to organic molecules'
      ])
    }),
    Object.freeze({
      title:'United States University',
      level:'university',
      country:'United States',
      sources:Object.freeze([
        source('United States university organic chemistry sequence','https://example.org/curricula/united-states-university-organic-chemistry','catalog'),
        source('United States organic chemistry lecture guide','https://example.org/curricula/united-states-organic-chemistry-guide','guide')
      ]),
      topics:Object.freeze([
        'Structure and bonding',
        'Resonance',
        'Acids and bases',
        'Conformations',
        linkedTopic('Substitution','reaction-mechanisms'),
        linkedTopic('Elimination','reaction-mechanisms'),
        'Alkenes and alkynes',
        linkedTopic('Aromatics','aromatic-chemistry'),
        'Alcohols and ethers',
        'Carbonyl chemistry',
        'Carboxylic acid derivatives',
        'Amines',
        'Synthesis',
        linkedTopic('Spectroscopy','spectroscopy')
      ])
    }),
    Object.freeze({
      title:'France High School',
      level:'high-school',
      country:'France',
      sources:Object.freeze([
        source('France high school organic chemistry overview','https://example.org/curricula/france-high-school-organic-chemistry','syllabus'),
        source('France lycée chemistry skills guide','https://example.org/curricula/france-lycee-chemistry-guide','guide')
      ]),
      topics:Object.freeze([
        'Structure of organic entities',
        'Semi-developed formulas',
        'Combustion and transformations',
        'Organic synthesis basics',
        'Chromatography basics',
        linkedTopic('Functional-group introduction','functional-groups')
      ])
    }),
    Object.freeze({
      title:'France University',
      level:'university',
      country:'France',
      sources:Object.freeze([
        source('France university organic chemistry sequence','https://example.org/curricula/france-university-organic-chemistry','catalog'),
        source('France licence chemistry curriculum guide','https://example.org/curricula/france-licence-chemistry-guide','guide')
      ]),
      topics:Object.freeze([
        'Chimie organique 1',
        linkedTopic('Reaction mechanisms','reaction-mechanisms'),
        'Organic synthesis',
        linkedTopic('Spectroscopy','spectroscopy'),
        'Structural identification',
        'Polymers'
      ])
    })
  ]);

  /** @type {readonly CurriculumCountry[]} */
  const countries=Object.freeze(['Egypt','England','United States','France']);

  window.OrganoCurriculumData=Object.freeze({
    countries,
    entries
  });
})();
