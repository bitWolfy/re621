import { PostRating } from "../api/responses/APIPost";
import { Tag } from "../data/Tag";
import { PostData } from "./PostData";

export class PostFilter {

    private entries: Filter[];          // individual filters
    private enabled: boolean;           // if false, the filters are ignored
    private matchIDs: Set<number>;       // post IDs matched by the filter
    private optionals: number;          // number of optional filters

    constructor(input: string, enabled = true) {
        this.entries = [];
        this.enabled = enabled;
        this.matchIDs = new Set();
        this.optionals = 0;

        input = input.toLowerCase().trim();

        for (let filter of new Set(input.split(" ").filter(e => e != ""))) {

            // Filter is optional
            const optional = filter.startsWith("~");
            if (optional) {
                filter = filter.substring(1);
                this.optionals++;
            }

            // Filter is inverted
            const inverse = filter.startsWith("-");
            if (inverse) filter = filter.substring(1);

            // Get filter type: tag, id, score, rating, etc.
            const filterType = FilterType.test(filter);
            if (filterType !== FilterType.Tag)
                filter = filter.substring(filterType.length);

            // Get comparison methods: equals, smaller then, etc
            const comparison = ComparisonType.test(filter);
            if (comparison !== ComparisonType.Equals)
                filter = filter.substring(comparison.length);

            this.entries.push({ type: filterType, value: filter, inverted: inverse, optional: optional, comparison: comparison });
        }
    }

    /**
     * Tests the provided post agains the filter, and adds it to the cache if it passes.  
     * Should be triggered every time a post is added or updated.
     * @param post Post to test against
     * @param shouldDecrement If false, does not remove the post from the filter if the tests fail
     * @returns Whether or not the filter matches the post
     */
    public update(post: PostData | PostData[], shouldDecrement = true): boolean {

        // Take care of the multiple posts separately
        if (Array.isArray(post)) {
            for (const entry of post) this.update(entry);
            return;
        }

        // Check if the post matches the filter
        let result = true;
        let optionalHits = 0;
        for (const filter of this.entries) {

            const value = filter.value;
            switch (filter.type) {
                case FilterType.Flag:
                    result = post.flags.has(value);
                    break;
                case FilterType.Id:
                    result = PostFilterUtils.compareNumbers(post.id, parseInt(value), filter.comparison);
                    break;
                case FilterType.Rating:
                    result = post.rating === PostRating.fromValue(value);
                    break;
                case FilterType.Score:
                    result = PostFilterUtils.compareNumbers(post.score, parseInt(value), filter.comparison);
                    break;
                case FilterType.Tag:
                    result = PostFilterUtils.tagsMatchesFilter(post, value);
                    break;
                case FilterType.Uploader:
                    result = post.uploader === parseInt(value);
                    break;
                case FilterType.Fav:
                    result = post.is_favorited;
                    break;
            }

            // Invert the result if necessary
            if (filter.inverted) result = !result;

            if (filter.optional) optionalHits += result ? 1 : 0;
            else if (!result) break;
        }

        // The post must match all normal filters, and at least one optional one
        result = result && (this.optionals == 0 || optionalHits > 0);

        if (result === true) this.matchIDs.add(post.id);
        else if (result === false && shouldDecrement) this.matchIDs.delete(post.id);
        return result;
    }

    /**
     * Returns true if the provided post matches the filter
     * @param post Post to test against the filter
     * @param ignoreDisabled Return the result regardless of the filter's state
     */
    public matches(post: PostData, ignoreDisabled = false): boolean {
        return this.matchesID(post.id, ignoreDisabled);
    }

    /**
     * Returns true if the provided post matches the filter
     * @param id ID of the post to test against the filter
     * @param ignoreDisabled Return the result regardless of the filter's state
     */
    public matchesID(id: number, ignoreDisabled = false): boolean {
        return (this.enabled || ignoreDisabled) && this.matchIDs.has(id);
    }

    public getMatches(): Set<number> { return this.matchIDs; }
    public getMatchesCount(): number { return this.matchIDs.size; }

    public toggleEnabled(): void { this.enabled = !this.enabled; }
    public setEnabled(enabled: boolean): void { this.enabled = enabled; }
    public isEnabled(): boolean { return this.enabled; }

}

class PostFilterUtils {

    /** Returns true if the two provided numbers pass the specified comparison type */
    public static compareNumbers(a: number, b: number, mode: ComparisonType): boolean {
        switch (mode) {
            case ComparisonType.Equals: return a === b;
            case ComparisonType.Smaller: return a < b;
            case ComparisonType.EqualsSmaller: return a <= b;
            case ComparisonType.Larger: return a > b;
            case ComparisonType.EqualsLarger: return a >= b;
        }
    }

    /** Returns true if the specified post has the provided tag */
    public static tagsMatchesFilter(post: PostData, filter: string): boolean {
        if (filter.includes("*")) {
            const regex = Tag.escapeSearchToRegex(filter);
            return regex.test([...post.tags.all].join(" "));
        }
        return post.tags.all.has(filter);
    }

}

interface Filter {
    type: FilterType;
    value: string;
    inverted: boolean;
    optional: boolean;
    comparison: ComparisonType;
}

enum FilterType {
    Tag = "tag:",
    Id = "id:",
    Score = "score:",
    Rating = "rating:",
    Uploader = "uplaoder:",
    Flag = "status:",
    Fav = "fav:",
}

namespace FilterType {
    export function test(input: string): FilterType {
        input = input.toLowerCase();
        for (const key of Object.keys(FilterType))
            if (input.startsWith(FilterType[key])) return FilterType[key];
        return FilterType.Tag;
    }
}

// Its important that they are in this order
// should the one character ones be in front they will match
// before the other ones have a chance
enum ComparisonType {
    EqualsSmaller = "<=",
    EqualsLarger = ">=",
    Equals = "=",
    Smaller = "<",
    Larger = ">"
}

namespace ComparisonType {
    export function test(input: string): ComparisonType {
        input = input.toLowerCase();
        for (const key of Object.keys(ComparisonType))
            if (input.startsWith(ComparisonType[key])) return ComparisonType[key];
        return ComparisonType.Equals;
    }
}