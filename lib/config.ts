"use strict";

import fs = require("fs");

import r = require("./utils/regexp");

import raw = require("./raw");
import Target = require("./target");
import Rule = require("./rule");
import ChangeSet = require("./changeset");

class Config {
	version:number;
	targets:Target[];
	rules:Rule[];

	constructor(src:raw.Config) {
		if (!src) {
			throw new Error("src is requried");
		}
		this.version = +src.version || 1;
		this.targets = (src.targets || []).map(target => new Target(target));
		this.rules = (src.rules || []).map(rule => new Rule(rule));
	}

	merge(other:Config) {
		if (!other) {
			throw new Error("other is required");
		}
		if (this.version !== other.version) {
			throw new Error("version mismatch!");
		}
		other.targets.forEach(otherTarget => {
			var exists = this.targets.filter(target => r.equals(target.file, otherTarget.file)).length !== 0;
			if (!exists) {
				this.targets.push(otherTarget);
			}
		});
		other.rules.forEach(otherRule => {
			var exists = this.rules.filter(rule => rule.expected === otherRule.expected).length !== 0;
			if (!exists) {
				this.rules.push(otherRule);
			}
		});
	}

	replaceByRule(filePath:string, content?:string) {
		if (content == null) {
			content = fs.readFileSync(filePath, {encoding: "utf8"});
		}
		var changeSets:ChangeSet[] = [];
		this.rules.map(rule => {
			rule.reset();
			var set = ChangeSet.makeChangeSet(content, rule.pattern, rule.expected);
			changeSets = changeSets.concat(set);
		});

		var includes:ChangeSet[] = [];
		var excludes:ChangeSet[] = [];
		var includesExists = false;
		var excludesExists = false;
		this.targets.forEach(target => {
			target.reset();
			if (!target.file.test(filePath)) {
				return;
			}
			if (target.includes.length !== 0) {
				includesExists = true;
				target.includes.forEach(include => {
					includes = includes.concat(ChangeSet.makeChangeSet(content, include.pattern, null));
				});
			}
			if (target.excludes.length !== 0) {
				excludesExists = true;
				target.excludes.forEach(exclude => {
					excludes = excludes.concat(ChangeSet.makeChangeSet(content, exclude.pattern, null));
				});
			}
		});

		if (includesExists) {
			changeSets = ChangeSet.intersect(changeSets, includes);
		}
		if (excludesExists) {
			changeSets = ChangeSet.subtract(changeSets, excludes);
		}

		return ChangeSet.applyChangeSets(content, changeSets);
	}
}

export = Config;