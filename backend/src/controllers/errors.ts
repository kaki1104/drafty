import { Request, Response } from 'express';
import { makeRenderObject } from '../config/handlebars-helpers';
import { sheetsData }  from '../models/sheet';
import path from 'path';
import logger from '../util/logger';

function getSheets() {
    const sheets: Array<Record<string, any>> = [];
    sheetsData.forEach((data, sheetUrl) => {
      if(data.on_homepage) {
        const link = '/' + sheetUrl;
        sheets.push({
          link: link,
          name: data.name
        });
      }
    });
    return sheets;
  }

/**
 * GET /
 * Home page after 500 error.
 */
export async function error500 (req: Request, res: Response) {
  console.log('ERROR --- error500');
  logger.error('');
  res.render(path.join(__dirname, '../../views/pages/home500'), makeRenderObject({
    errors: true,
    ignoreHeader: true,
    ignoreFooter: true,
    title: 'Home',
    sheets: getSheets(),
    publications: [
      {
        link: 'https://jeffhuang.com/Final_Drafty_HCOMP17.pdf',
        name: 'Drafty: Enlisting Users to be Editors who Maintain Structured Data',
        description: 'Shaun Wallace, Lucy van Kleunen, Marianne Aubin-Le Quere, Abraham Peterkin, Yirui Huang, Jeff Huang. HCOMP 2017'
      },
    ]
  }, req));
}


/**
 * GLOBAL MIDDLEWARE
 */
export async function errors(err: Error, req: Request, res: Response){
  res.status(500);
  console.log('ERRORS...',req.url);
  //req.flash("errors", { msg: `Oops! There appears to be an error, our elves are hard at work on fixing it.`});
  //res.redirect("/?errors");

  res.render('pages/home', makeRenderObject({
    errors: true,
    ignoreHeader: true,
    ignoreFooter: true,
    title: 'HOME',
    publications: [
      {
        link: 'https://jeffhuang.com/Final_Drafty_HCOMP17.pdf',
        name: 'Drafty: Enlisting Users to be Editors who Maintain Structured Data',
        description: 'Shaun Wallace, Lucy van Kleunen, Marianne Aubin-Le Quere, Abraham Peterkin, Yirui Huang, Jeff Huang. HCOMP 2017'
      },
    ]
  }, req));
}